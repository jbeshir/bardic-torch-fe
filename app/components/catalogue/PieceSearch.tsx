import { useId } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";
import { useHydrated } from "~/hooks/useHydrated";
import { pieceQuery, type PieceQueryState } from "~/catalogue/query-state";
import { CatalogueSearch } from "./CatalogueSearch";

const PIECES_ACTION = "/pieces";

/**
 * The search box at the top of `/pieces` (plan §2.5): it keeps the filters
 * (`term`, `kind`, `status`, `stub`) and drops the letter, the order and
 * the page, so a search covers every letter from its first page.
 */
export function PieceSearch({ state }: { readonly state: PieceQueryState }) {
  return (
    <CatalogueSearch
      query={pieceQuery}
      action={PIECES_ACTION}
      landmark="Pieces"
      label="Search pieces"
      q={state.q}
      keepHref={pieceQuery.href(state, {
        q: undefined,
        letter: undefined,
        sort: undefined,
      })}
    />
  );
}

/**
 * The order of a search's results (plan §2.5, §4.2), shown only with `q`:
 * "Best match" (the default, relevance, sent empty) or "Title A–Z". It sits above the
 * results but belongs to the facet form (`form`), so without JS the
 * form's own submit applies it with the filters: its "Sort" button here,
 * or "Apply filters". With JS a change applies at once, as a link would.
 */
export function PieceSort({
  state,
  form,
}: {
  readonly state: PieceQueryState;
  /** The facet form's id. */
  readonly form: string;
}) {
  const labelId = useId();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-2">
        <span id={labelId} className="text-body-sm font-semibold text-fg">
          Sort by
        </span>
        <Select
          name="sort"
          form={form}
          aria-labelledby={labelId}
          defaultValue={state.sort ?? ""}
          onChange={event => {
            void navigate(
              pieceQuery.href(state, {
                sort:
                  event.currentTarget.value === "title" ? "title" : undefined,
              }),
              { preventScrollReset: true }
            );
          }}
        >
          {/* The default sends an empty sort: no order, so no redirect. */}
          <option value="">Best match</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>
      {hydrated ? null : (
        <Button type="submit" form={form} variant="secondary">
          Sort
        </Button>
      )}
    </div>
  );
}
