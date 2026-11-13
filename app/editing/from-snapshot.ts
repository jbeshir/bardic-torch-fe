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
 * A person with a null slug (prefers no page) can't be referenced, so is skipped.
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
  performer_slugs: p.performers.flatMap(({ slug }) =>
    slug === null ? [] : [slug]
  ),
});

function pieceFromSnapshot(piece: Snapshot<"piece">): Partial<PieceDocument> {
  return {
    title: piece.title,
    kind: piece.kind,
    conservation_status: piece.conservation_status,
    is_stub: piece.is_stub,
    notes_md: piece.notes_md,
    version_notes_md: piece.version_notes_md,
    licensing_status: piece.licensing_status,
    licensing_notes_md: piece.licensing_notes_md,
    aliases: piece.aliases.map(alias => ({ ...alias })),
    term_slugs: piece.terms.map(term => term.slug),
    credits: piece.credits.flatMap(({ person, ...credit }) =>
      person?.slug === null
        ? []
        : [{ ...credit, person_slug: person?.slug ?? null }]
    ),
    links: piece.links.map(link => ({
      ...linkFields(link),
      performances: link.performances.map(performanceFields),
    })),
  };
}

function personFromSnapshot(
  snapshot: Snapshot<"person">
): Partial<PersonDocument> {
  const { name, kind, status, is_stub } = snapshot;
  const top = { name, kind, status, is_stub };
  const { profile } = snapshot;
  if (profile === null) return top;
  return {
    ...top,
    notes_md: profile.notes_md,
    licensing_status: profile.licensing_status,
    licensing_notes_md: profile.licensing_notes_md,
    aliases: profile.aliases.map(alias => ({ ...alias })),
    roles: [...profile.roles],
    affiliation_slugs: profile.affiliations.map(term => term.slug),
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
    parent_slug: slugOf(parent),
    related_affiliation_slug: slugOf(related_affiliation),
  };
}

function collectionFromSnapshot(
  snapshot: Snapshot<"collection">
): Partial<CollectionDocument> {
  const { region, ...collection } = snapshot;
  return { ...collection, region_term_slug: slugOf(region) };
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
