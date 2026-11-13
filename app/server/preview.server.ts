import type { PersonView } from "~/components/person/PersonPage";
import type { PieceView } from "~/components/piece/PiecePage";
import { FACET_LABELS } from "~/constants/vocabulary";
import type { PersonDocument, PieceDocument } from "~/editing/documents";
import type { Option, Options } from "~/editing/editor-data";
import type { Facet, Piece } from "~/schemas/catalogue";
import { renderMarkdown } from "./markdown.server";

/**
 * A piece's or a person's editor document as the read view its page
 * renders, for the editor's Preview. References are slugs, so their names
 * come from the pickers' lists (the slug itself if it isn't public); what
 * only the API knows is blank: a link's liveness is unknown, and a
 * person's works and performances are empty.
 */

type Document = PieceDocument | PersonDocument;

/** A list's labels by value, trimmed of a term's indent. */
const namer = (options: readonly Option[] | undefined) => {
  const names = new Map(options?.map(o => [o.value, o.label.trim()]));
  return (key: string) => names.get(key) ?? key;
};

const FACETS = new Map(
  Object.entries(FACET_LABELS).map(([facet, label]) => [label, facet as Facet])
);

/** The summaries the read components take, from the option lists. */
function summaries(options: Options) {
  const person = namer(options.persons);
  const event = namer(options.events);
  const collection = namer(options.collections);
  return {
    person: (slug: string) => ({
      slug,
      name: person(slug),
      kind: "community_bard" as const,
      is_stub: false,
    }),
    event: (slug: string) => ({ slug, name: event(slug) }),
    link: (link: Document["links"][number]) => ({
      url: link.url,
      title: link.title,
      description: link.description,
      platform: link.platform,
      place_type: link.place_type,
      locator: link.locator,
      roles: link.roles,
      collection:
        link.collection_id === null
          ? null
          : {
              id: link.collection_id,
              name: collection(String(link.collection_id)),
            },
      liveness: "unknown" as const,
      last_checked_at: null,
      archived_url: null,
    }),
  };
}

export function previewPiece(
  document: PieceDocument,
  options: Options
): PieceView {
  const summary = summaries(options);
  const terms = new Map(options.terms?.map(o => [o.value, o]));
  const piece: Piece = {
    ...document,
    slug: "",
    credit_names: [],
    updated_at: "",
    terms: document.term_slugs.map(slug => ({
      slug,
      facet: FACETS.get(terms.get(slug)?.group ?? "") ?? "topic",
      display_name: terms.get(slug)?.label.trim() ?? slug,
    })),
    credits: document.credits.map(({ person_slug, ...credit }) => ({
      ...credit,
      person: person_slug === null ? null : summary.person(person_slug),
    })),
    links: document.links.map(link => ({
      ...summary.link(link),
      performances: link.performances.map(
        ({ event_slug, performer_slugs, ...performance }) => ({
          ...performance,
          event: event_slug === null ? null : summary.event(event_slug),
          performers: performer_slugs.map(summary.person),
        })
      ),
    })),
  };
  return {
    piece,
    markdown: {
      notes: renderMarkdown(document.notes_md),
      versions: renderMarkdown(document.version_notes_md),
      licensingNotes: renderMarkdown(document.licensing_notes_md),
    },
  };
}

export function previewPerson(
  document: PersonDocument,
  options: Options
): PersonView {
  const summary = summaries(options);
  const affiliation = namer(options.affiliations);
  return {
    person: {
      ...document,
      slug: "",
      updated_at: "",
      profile: {
        ...document,
        affiliations: document.affiliation_slugs.map(slug => ({
          slug,
          facet: "affiliation",
          display_name: affiliation(slug),
        })),
        links: document.links.map(summary.link),
        works: [],
        works_total: 0,
        performances: [],
        performances_total: 0,
      },
    },
    markdown: {
      notes: renderMarkdown(document.notes_md),
      licensingNotes: renderMarkdown(document.licensing_notes_md),
    },
  };
}
