import { IconSearch } from "@tabler/icons-react";
import { useId } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
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
  const { onSubmit } = useCanonicalSubmit(pieceQuery);
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
 * The order of a search's results (plan §4.2), shown only with `q`: "Best
 * match" (the default, relevance) or "Title A–Z". A GET form that keeps
 * the rest of the state; it applies when submitted, never on change.
 */
export function PieceSort({ state }: { readonly state: PieceQueryState }) {
  const { onSubmit } = useCanonicalSubmit(pieceQuery);
  const labelId = useId();
  return (
    <Form
      method="get"
      action={PIECES_ACTION}
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-2"
    >
      <HiddenFields href={pieceQuery.href(state, { sort: undefined })} />
      <div className="grid gap-2">
        <span id={labelId} className="text-body-sm font-semibold text-fg">
          Sort by
        </span>
        <Select
          name="sort"
          aria-labelledby={labelId}
          defaultValue={state.sort ?? "relevance"}
        >
          <option value="relevance">Best match</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>
      <Button type="submit" variant="secondary">
        Sort
      </Button>
    </Form>
  );
}
