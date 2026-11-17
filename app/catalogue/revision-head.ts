import type { Revision } from "~/schemas/catalogue";
import { revisionCredit } from "./revision-credit";
import { categoryPath } from "./term-page";

/** Where a revision's entity lives, what it's called, and its section. */
interface RevisionEntity {
  readonly section: { readonly label: string; readonly to: string };
  readonly noun: string;
  readonly title: string;
  readonly path: string;
}

/** The revision as its page shows it: its head, without the snapshots. */
export interface RevisionHead {
  readonly id: number;
  readonly baseRevisionId: number | null;
  readonly createdAt: string;
  readonly summary: string;
  readonly credit: string;
  readonly entity: RevisionEntity;
}

function entityOf(revision: Revision): RevisionEntity {
  switch (revision.entity_type) {
    case "piece":
      return {
        section: { label: "Pieces", to: "/pieces" },
        noun: "piece",
        title: revision.entity.title,
        path: `/pieces/${revision.entity.slug}`,
      };
    case "person":
      return {
        section: { label: "Bards", to: "/bards" },
        noun: "bard",
        title: revision.entity.name,
        // A revision's own person always has a slug: everyone keeps a page.
        path: `/bards/${revision.entity.slug}`,
      };
    case "term":
      return {
        section: { label: "Categories", to: "/categories" },
        noun: "category",
        title: revision.entity.display_name,
        path: categoryPath(revision.entity.slug),
      };
    case "collection":
      return {
        section: { label: "Collections", to: "/collections" },
        noun: "collection",
        title: revision.entity.name,
        path: `/collections/${revision.entity.id}`,
      };
    case "event":
      return {
        section: { label: "Events", to: "/events" },
        noun: "event",
        title: revision.entity.name,
        path: `/events/${revision.entity.slug}`,
      };
  }
}

/** The head of `revision`, as `/revisions/:id` shows it. */
export function revisionHead(revision: Revision): RevisionHead {
  return {
    id: revision.id,
    baseRevisionId: revision.base_revision_id,
    createdAt: revision.created_at,
    summary: revision.summary,
    credit: revisionCredit(revision),
    entity: entityOf(revision),
  };
}
