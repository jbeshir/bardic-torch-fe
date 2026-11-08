import { personQuery, type PersonQueryState } from "~/catalogue/query-state";
import { CatalogueSearch } from "./CatalogueSearch";

/**
 * The search box at the top of `/bards` (plan §4.7), as `/pieces`' is: it
 * keeps the filters (`kind`, `role`, `affiliation`) and drops the letter,
 * the order and the page.
 */
export function BardSearch({ state }: { readonly state: PersonQueryState }) {
  return (
    <CatalogueSearch
      query={personQuery}
      action="/bards"
      landmark="Bards"
      label="Search bards"
      q={state.q}
      keepHref={personQuery.href(state, {
        q: undefined,
        letter: undefined,
        sort: undefined,
      })}
    />
  );
}
