import { Link } from "~/components/ui/Link";
import { formatNumber } from "~/catalogue/format";
import { memberCount, memberTotal } from "~/catalogue/term-page";
import type { TermNode } from "~/catalogue/term-index";

/** A run of sibling terms, each with the run of its descendants. */
type Branch = { readonly term: TermNode; readonly children: readonly Branch[] };

/**
 * Nest `terms` (one facet's, in tree order, with their depths): each term
 * owns the deeper terms that follow it, up to the next of its own depth.
 */
function branches(terms: readonly TermNode[], depth: number): Branch[] {
  const result: Branch[] = [];
  let index = 0;
  while (index < terms.length) {
    const term = terms[index];
    if (term === undefined) break;
    let end = index + 1;
    while ((terms[end]?.depth ?? depth) > term.depth) end += 1;
    result.push({
      term,
      children: branches(terms.slice(index + 1, end), term.depth + 1),
    });
    index = end;
  }
  return result;
}

/**
 * What a term is called in the tree: its `display_name`, or its full
 * `name` (with the disambiguation suffix, "Story (Mood)") where two terms
 * of the facet share a display name.
 */
function labels(terms: readonly TermNode[]): ReadonlyMap<string, string> {
  const uses = new Map<string, number>();
  for (const { display_name } of terms) {
    uses.set(display_name, (uses.get(display_name) ?? 0) + 1);
  }
  return new Map(
    terms.map(term => [
      term.slug,
      (uses.get(term.display_name) ?? 0) > 1 ? term.name : term.display_name,
    ])
  );
}

function Branches({
  items,
  label,
  nested,
}: {
  readonly items: readonly Branch[];
  readonly label: ReadonlyMap<string, string>;
  readonly nested: boolean;
}) {
  return (
    <ul
      role="list"
      className={
        nested ? "mt-1 grid gap-1 border-l border-border pl-4" : "grid gap-1"
      }
    >
      {items.map(({ term, children }) => (
        <li key={term.slug}>
          <span className="inline-flex min-h-6 flex-wrap items-baseline gap-x-1.5">
            <Link to={`/categories/${term.slug}`} compact>
              {label.get(term.slug) ?? term.display_name}
            </Link>
            <span className="text-body-sm text-fg-subtle">
              <span aria-hidden="true">
                ({formatNumber(memberTotal(term))})
              </span>
              <span className="sr-only">{memberCount(term)}</span>
            </span>
          </span>
          {children.length > 0 ? (
            <Branches items={children} label={label} nested />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * One facet's terms as a nested list (plan §4.8): each term a link to its
 * category page with how many pieces (or, for an affiliation, bards) it
 * classifies, its children in a list of their own under it, indented on a
 * rule. The count reads "(31)" and is announced "31 pieces".
 */
export function TermTree({ terms }: { readonly terms: readonly TermNode[] }) {
  return (
    <Branches items={branches(terms, 0)} label={labels(terms)} nested={false} />
  );
}
