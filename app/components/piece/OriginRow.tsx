import { TagList } from "~/components/ui/TagList";
import type { Piece } from "~/schemas/catalogue";

/**
 * Where a piece comes from (plan §4.5): its `origin`-facet terms as chips to
 * their category pages, in the API's order. Null when the piece has no
 * origin, so the row is left out.
 */
export function OriginRow({ terms }: { readonly terms: Piece["terms"] }) {
  const origins = terms.filter(term => term.facet === "origin");
  if (origins.length === 0) return null;
  return (
    <TagList
      size="sm"
      tags={origins.map(term => ({
        label: term.display_name,
        to: `/categories/${term.slug}`,
      }))}
    />
  );
}

/** Whether a piece has an origin to show. */
export function hasOrigin(terms: Piece["terms"]): boolean {
  return terms.some(term => term.facet === "origin");
}
