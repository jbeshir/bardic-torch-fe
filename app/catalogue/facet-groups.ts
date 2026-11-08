import {
  CONSERVATION_STATUS_VALUES,
  FACETS,
  PIECE_KINDS,
} from "~/constants/enums";
import {
  CONSERVATION_LABELS,
  FACET_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type {
  ConservationStatus,
  Facet,
  PieceFacets,
  PieceKind,
} from "~/schemas/catalogue";
import type { TermIndex, TermNode } from "./term-index";

/**
 * The facet column's groups (plan §2.3): the API's facet counts
 * (`facets.terms` is only slugs and counts) joined with the term tree, so
 * each option has its name, its facet and its depth.
 */

/** The facets that classify pieces, in the API's order. */
type PieceFacet = Exclude<Facet, "affiliation">;

const PIECE_FACETS = FACETS.filter(
  (facet): facet is PieceFacet => facet !== "affiliation"
);

/** A group longer than this shows its first options and "Show all {n}". */
const SHOWN_MAX = 8;

export type FacetOption = {
  /** The form value: a term's slug, a kind or a status. */
  readonly value: string;
  readonly label: string;
  /**
   * The pieces matching every other facet's filters and this value (the
   * API's disjunctive count), 0 when the API lists none.
   */
  readonly count: number;
  /** How deep the term is in its facet's tree; 0 for kinds and statuses. */
  readonly depth: number;
  readonly selected: boolean;
  /** Nothing would match: greyed and not tickable, unless already ticked. */
  readonly disabled: boolean;
};

export type FacetGroup = {
  /** "kind", a piece facet, or "status". */
  readonly key: "kind" | PieceFacet | "status";
  /** The form field its boxes submit. */
  readonly name: "kind" | "term" | "status";
  readonly legend: string;
  /** Shown at once: the first options in tree order, and every ticked one. */
  readonly shown: readonly FacetOption[];
  /** Behind "Show all {n}" (still submitted: a closed details keeps them). */
  readonly more: readonly FacetOption[];
};

/** What is ticked: the state's `term`, `kind` and `status`. */
type Selection = {
  readonly term: readonly string[];
  readonly kind: readonly PieceKind[];
  readonly status: readonly ConservationStatus[];
};

function option(
  value: string,
  label: string,
  count: number,
  depth: number,
  selected: readonly string[]
): FacetOption {
  const ticked = selected.includes(value);
  return {
    value,
    label,
    count,
    depth,
    selected: ticked,
    disabled: count === 0 && !ticked,
  };
}

function group(
  key: FacetGroup["key"],
  name: FacetGroup["name"],
  legend: string,
  options: readonly FacetOption[]
): FacetGroup {
  const shown = options.filter(
    (item, index) => index < SHOWN_MAX || item.selected
  );
  return {
    key,
    name,
    legend,
    shown,
    more: options.filter(item => !shown.includes(item)),
  };
}

/**
 * A facet's options: its terms that classify any piece at all, so the set
 * doesn't change as other filters do (an option never vanishes under the
 * pointer), in tree order, and any selected term even if it classifies
 * none (so the next Apply, built from the form, keeps it). Two options with one display name show their
 * full names, which carry the disambiguation.
 */
function termOptions(
  terms: readonly TermNode[],
  counts: ReadonlyMap<string, number>,
  selected: readonly string[]
): readonly FacetOption[] {
  const listed = terms.filter(
    term => term.piece_count > 0 || selected.includes(term.slug)
  );
  const names = listed.map(term => term.display_name);
  return listed.map(term =>
    option(
      term.slug,
      names.indexOf(term.display_name) === names.lastIndexOf(term.display_name)
        ? term.display_name
        : term.name,
      counts.get(term.slug) ?? 0,
      term.depth,
      selected
    )
  );
}

/**
 * The groups in the facet column's order: Kind, the term facets in the
 * API's order (mood … other), then Conservation status. Kind and
 * Conservation status list every value. A term facet with no options is
 * left out, and so are the term facets when `index` is null (the terms
 * couldn't be loaded). A counted slug the index doesn't know (approved
 * since the terms were read) is ignored.
 */
export function facetGroups(
  index: TermIndex | null,
  facets: PieceFacets,
  selection: Selection
): readonly FacetGroup[] {
  const kindCounts = new Map(facets.kinds.map(item => [item.kind, item.count]));
  const statusCounts = new Map(
    facets.conservation_statuses.map(item => [
      item.conservation_status,
      item.count,
    ])
  );
  const termCounts = new Map(facets.terms.map(item => [item.slug, item.count]));

  const kinds = group(
    "kind",
    "kind",
    "Kind",
    PIECE_KINDS.map(kind =>
      option(
        kind,
        PIECE_KIND_LABELS[kind],
        kindCounts.get(kind) ?? 0,
        0,
        selection.kind
      )
    )
  );
  const terms = index
    ? PIECE_FACETS.flatMap(facet => {
        const options = termOptions(
          index.byFacet.get(facet) ?? [],
          termCounts,
          selection.term
        );
        return options.length > 0
          ? [group(facet, "term", FACET_LABELS[facet], options)]
          : [];
      })
    : [];
  const statuses = group(
    "status",
    "status",
    "Conservation status",
    CONSERVATION_STATUS_VALUES.map(status =>
      option(
        status,
        CONSERVATION_LABELS[status],
        statusCounts.get(status) ?? 0,
        0,
        selection.status
      )
    )
  );
  return [kinds, ...terms, statuses];
}

/**
 * A selected term's chip label, "Mood: Warlike"; its slug when the terms
 * couldn't be loaded (or it isn't a term any more).
 */
export function termChipLabel(index: TermIndex | null, slug: string): string {
  const term = index?.bySlug.get(slug);
  return term
    ? `${FACET_LABELS[term.facet]}: ${term.display_name}`
    : `Category: ${slug}`;
}
