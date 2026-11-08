import { formatCount } from "~/catalogue/format";
import { FACET_LABELS } from "~/constants/vocabulary";
import type { Facet } from "~/schemas/catalogue";

/** A category's address. */
export function categoryPath(slug: string): `/categories/${string}` {
  return `/categories/${slug}`;
}

/** What a term's counts are read from. */
type Counted = {
  readonly facet: Facet;
  readonly piece_count: number;
  readonly person_count: number;
};

/**
 * How many members a term has: the persons of an affiliation (its members
 * are bards), the pieces of any other facet.
 */
export function memberTotal(term: Counted): number {
  return term.facet === "affiliation" ? term.person_count : term.piece_count;
}

/** A term's members as the reader counts them: "12 pieces", "3 bards". */
export function memberCount(term: Counted): string {
  return formatCount(
    memberTotal(term),
    term.facet === "affiliation" ? "bard" : "piece"
  );
}

/** A category's meta line: "Topic · 12 pieces", "Affiliation · 3 bards". */
export function categoryMeta(term: Counted): string {
  return `${FACET_LABELS[term.facet]} · ${memberCount(term)}`;
}
