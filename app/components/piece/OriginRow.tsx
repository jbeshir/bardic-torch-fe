import { TagList } from "~/components/ui/TagList";
import { PIECE_PART_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";

/**
 * Where a piece comes from (plan §4.5): its `origin`-facet terms as chips to
 * their category pages, the main source first and marked so, each other one
 * with the part it is the origin of, "Tune: 16th Century". Null when the
 * piece has no origin, so the row is left out.
 */
export function OriginRow({ terms }: { readonly terms: Piece["terms"] }) {
  // The main source first; the rest keep the API's order (a stable sort).
  const origins = terms
    .filter(({ term }) => term.facet === "origin")
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  if (origins.length === 0) return null;
  return (
    <TagList
      size="sm"
      tags={origins.map(({ term, is_primary, part }) => ({
        label: is_primary
          ? `${term.display_name} (main source)`
          : term.display_name,
        to: `/categories/${term.slug}`,
        ...(part ? { prefix: `${PIECE_PART_LABELS[part]}:` } : {}),
      }))}
    />
  );
}

/** Whether a piece has an origin to show. */
export function hasOrigin(terms: Piece["terms"]): boolean {
  return terms.some(({ term }) => term.facet === "origin");
}
