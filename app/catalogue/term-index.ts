import type { Facet, TermListItem } from "~/schemas/catalogue";

/** A term of the tree, with how deep it sits under its facet's roots. */
export type TermNode = TermListItem & {
  /** 0 for a root, 1 for its children, and so on. */
  readonly depth: number;
};

export type TermIndex = {
  readonly bySlug: ReadonlyMap<string, TermNode>;
  /** Each facet's terms in tree order (parents before their children). */
  readonly byFacet: ReadonlyMap<Facet, readonly TermNode[]>;
};

/**
 * The term tree of one `listTerms` answer (plan §2.3), which the API
 * already lists in tree order: each parent before its children. So the
 * depths come from the parent chain in one pass. A term whose parent isn't
 * listed (it can't happen with a whole tree) is taken as a root.
 */
export function buildTermIndex(terms: readonly TermListItem[]): TermIndex {
  const bySlug = new Map<string, TermNode>();
  const byFacet = new Map<Facet, TermNode[]>();
  for (const term of terms) {
    const parent =
      term.parent_slug === null ? undefined : bySlug.get(term.parent_slug);
    const node: TermNode = {
      ...term,
      depth: parent === undefined ? 0 : parent.depth + 1,
    };
    bySlug.set(term.slug, node);
    const siblings = byFacet.get(term.facet);
    if (siblings) siblings.push(node);
    else byFacet.set(term.facet, [node]);
  }
  return { bySlug, byFacet };
}

/**
 * Whether `slug` is a term `listPieces` takes as a `term` filter: a public
 * term of a piece facet. An affiliation classifies persons, so the API
 * refuses it (400) like an unknown slug.
 */
export function isPieceTerm(index: TermIndex, slug: string): boolean {
  const term = index.bySlug.get(slug);
  return term !== undefined && term.facet !== "affiliation";
}
