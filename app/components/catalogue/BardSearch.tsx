import { IconSearch } from "@tabler/icons-react";
import { Form } from "react-router";
import { personQuery, type PersonQueryState } from "~/catalogue/query-state";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { HiddenFields, useCanonicalSubmit } from "./canonical-form";

/**
 * The search box at the top of `/bards` (plan §4.7), as `/pieces`' is: its
 * own GET form, which keeps the filters (`kind`, `role`, `affiliation`) as
 * hidden inputs and drops the letter, the order and the page.
 */
export function BardSearch({ state }: { readonly state: PersonQueryState }) {
  const onSubmit = useCanonicalSubmit(personQuery);
  return (
    <Form
      method="get"
      action="/bards"
      role="search"
      aria-label="Bards"
      onSubmit={onSubmit}
      className="flex gap-2"
    >
      <HiddenFields
        href={personQuery.href(state, {
          q: undefined,
          letter: undefined,
          sort: undefined,
        })}
      />
      <div className="min-w-0 flex-1">
        <Input
          type="search"
          name="q"
          aria-label="Search bards"
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
