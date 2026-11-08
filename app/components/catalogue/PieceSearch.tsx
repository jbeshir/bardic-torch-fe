import { IconSearch } from "@tabler/icons-react";
import { useId } from "react";
import { Form, useNavigate } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { useHydrated } from "~/hooks/useHydrated";
import { pieceQuery, type PieceQueryState } from "~/catalogue/query-state";
import { HiddenFields, useCanonicalSubmit } from "./canonical-form";

const PIECES_ACTION = "/pieces";

/**
 * The search box at the top of `/pieces` (plan §2.5): its own GET form,
 * which keeps the filters (`term`, `kind`, `status`, `stub`) as hidden
 * inputs and drops the letter, the order and the page, so a search covers
 * every letter from its first page.
 */
export function PieceSearch({ state }: { readonly state: PieceQueryState }) {
  const onSubmit = useCanonicalSubmit(pieceQuery);
  return (
    <Form
      method="get"
      action={PIECES_ACTION}
      role="search"
      aria-label="Pieces"
      onSubmit={onSubmit}
      className="flex gap-2"
    >
      <HiddenFields
        href={pieceQuery.href(state, {
          q: undefined,
          letter: undefined,
          sort: undefined,
        })}
      />
      <div className="min-w-0 flex-1">
        <Input
          type="search"
          name="q"
          aria-label="Search pieces"
          icon={IconSearch}
          defaultValue={state.q ?? ""}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </Form>
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
