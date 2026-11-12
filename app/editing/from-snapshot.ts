import type { Revision } from "~/schemas/catalogue";
import type {
  CollectionDocument,
  EventDocument,
  PersonDocument,
  PieceDocument,
  TermDocument,
} from "./documents";

/**
 * A public revision's snapshot as the editor's document (the inverse of
 * the API's snapshot views): references that are summaries become slugs,
 * collections ids. Each function gives the fields the snapshot has; the
 * caller lays them over the entity's editable document, so a person
 * snapshot without a profile leaves the profile fields as they are.
 */

type Snapshot<T extends Revision["entity_type"]> = Extract<
  Revision,
  { entity_type: T }
>["snapshot"];

type PieceLink = Snapshot<"piece">["links"][number];
type PersonLink = NonNullable<Snapshot<"person">["profile"]>["links"][number];

const slugOf = (summary: { readonly slug: string } | null) =>
  summary?.slug ?? null;

const linkFields = (link: PieceLink | PersonLink) => ({
  url: link.url,
  title: link.title,
  description: link.description,
  platform: link.platform,
  place_type: link.place_type,
  collection_id: link.collection?.id ?? null,
  locator: link.locator,
  roles: [...link.roles],
});

const performanceFields = (p: PieceLink["performances"][number]) => ({
  event_slug: slugOf(p.event),
  year: p.year,
  uploader: p.uploader,
  description_verbatim: p.description_verbatim,
  performer_slugs: p.performers.map(person => person.slug),
});

function pieceFromSnapshot(
  snapshot: Snapshot<"piece">
): Partial<PieceDocument> {
  const { conservation_status, conservation_source_url, ...piece } = snapshot;
  return {
    title: piece.title,
    kind: piece.kind,
    secondary_kinds: [...piece.secondary_kinds],
    conservation: {
      status: conservation_status,
      source_url: conservation_source_url,
    },
    is_stub: piece.is_stub,
    notes_md: piece.notes_md,
    version_notes_md: piece.version_notes_md,
    licensing_status: piece.licensing_status,
    licensing_notes_md: piece.licensing_notes_md,
    licence: piece.licence,
    licence_version: piece.licence_version,
    historical_source_md: piece.historical_source_md,
    period_start: piece.period_start,
    period_end: piece.period_end,
    aliases: piece.aliases.map(alias => ({ ...alias })),
    terms: piece.terms.map(({ term, is_primary, part }) => ({
      term_slug: term.slug,
      is_primary,
      part,
    })),
    relations: piece.relations.map(r => ({
      to_piece_slug: r.piece.slug,
      type: r.type,
    })),
    credits: piece.credits.map(({ person, ...credit }) => ({
      ...credit,
      person_slug: slugOf(person),
    })),
    links: piece.links.map(link => ({
      ...linkFields(link),
      performances: link.performances.map(performanceFields),
    })),
  };
}

function personFromSnapshot(
  snapshot: Snapshot<"person">
): Partial<PersonDocument> {
  const { name, kind, status, status_date, status_source_url, is_stub } =
    snapshot;
  const top = { name, kind, status, status_date, status_source_url, is_stub };
  const { profile } = snapshot;
  if (profile === null) return top;
  return {
    ...top,
    pronouns: profile.pronouns,
    notes_md: profile.notes_md,
    licensing_status: profile.licensing_status,
    licensing_notes_md: profile.licensing_notes_md,
    aliases: profile.aliases.map(alias => ({ ...alias })),
    roles: [...profile.roles],
    affiliation_slugs: profile.affiliations.map(term => term.slug),
    relations: profile.relations.map(r => ({
      to_person_slug: r.person.slug,
      type: r.type,
    })),
    links: profile.links.map(link => ({
      ...linkFields(link),
      performances: link.performances.map(p => ({
        piece_slug: slugOf(p.piece),
        ...performanceFields(p),
      })),
    })),
  };
}

function termFromSnapshot(snapshot: Snapshot<"term">): Partial<TermDocument> {
  const { parent, related_affiliation, ...term } = snapshot;
  return {
    ...term,
    aliases: [...term.aliases],
    parent_slug: slugOf(parent),
    related_affiliation_slug: slugOf(related_affiliation),
  };
}

function collectionFromSnapshot(
  snapshot: Snapshot<"collection">
): Partial<CollectionDocument> {
  const { region, parent, ...collection } = snapshot;
  return {
    ...collection,
    region_term_slug: slugOf(region),
    parent_id: parent?.id ?? null,
  };
}

const eventFromSnapshot = (
  snapshot: Snapshot<"event">
): Partial<EventDocument> => ({ ...snapshot });

/** The editor document fields `revision`'s snapshot sets. */
export function fromSnapshot(revision: Revision) {
  switch (revision.entity_type) {
    case "piece":
      return pieceFromSnapshot(revision.snapshot);
    case "person":
      return personFromSnapshot(revision.snapshot);
    case "term":
      return termFromSnapshot(revision.snapshot);
    case "collection":
      return collectionFromSnapshot(revision.snapshot);
    case "event":
      return eventFromSnapshot(revision.snapshot);
  }
}
