import { IconSearch } from "@tabler/icons-react";
import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { canonicalFormHref } from "~/catalogue/form-href";
import { HiddenFields, useCanonicalSubmit } from "./canonical-form";

/**
 * A directory's search box (plan §2.5): its own GET form to `action`, a
 * search landmark named `landmark`, which keeps the state in `keepHref`
 * (the filters, never the letter, the order or the page, so a search covers
 * every letter from its first page) as hidden inputs. With JS it goes
 * straight to the canonical URL; without, the loader answers the fields in
 * DOM order 200.
 */
export function CatalogueSearch<State>({
  query,
  action,
  landmark,
  label,
  q,
  keepHref,
}: {
  readonly query: Parameters<typeof canonicalFormHref<State>>[1];
  readonly action: string;
  /** The search landmark's name: "Pieces". */
  readonly landmark: string;
  /** The field's name: "Search pieces". */
  readonly label: string;
  /** The search the page shows, if any. */
  readonly q: string | undefined;
  /** The page's URL with what the search keeps. */
  readonly keepHref: string;
}) {
  const onSubmit = useCanonicalSubmit(query);
  return (
    <Form
      method="get"
      action={action}
      role="search"
      aria-label={landmark}
      onSubmit={onSubmit}
      className="flex gap-2"
    >
      <HiddenFields href={keepHref} />
      <div className="min-w-0 flex-1">
        <Input
          type="search"
          name="q"
          aria-label={label}
          icon={IconSearch}
          defaultValue={q ?? ""}
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
