import { IconSearch } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { canonicalFormHref } from "~/catalogue/form-href";
import { HiddenFields, useCanonicalSubmit } from "./canonical-form";

/**
 * A directory's search box (plan §2.5, DESIGN §10.7), the one `/pieces`
 * and `/bards` share so they behave and look alike: its own GET form to
 * `action`, a search landmark named `landmark`, a 44 px search field named
 * `label` (no placeholder: the name is the field's, and a hint would only
 * repeat it) and a secondary "Search" submit. It keeps the state in
 * `keepHref` (the filters, never the letter, the order or the page, so a
 * search covers every letter from its first page) as hidden inputs. With
 * JS it goes straight to the canonical URL; without, the loader answers
 * the fields in DOM order 200.
 *
 * The form is never remounted, so focus stays in the field after a search.
 * The field follows the page's search (`q`): when a chip, "Clear search" or
 * Back changes it, the box says so instead of keeping what was typed.
 * Escape empties the box (as Chromium's own search fields do, in every
 * browser) without leaving the page; Search, or Enter, with it empty drops
 * the search.
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
  const boxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (box && box.value !== (q ?? "")) box.value = q ?? "";
  }, [q]);
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
          ref={boxRef}
          type="search"
          name="q"
          aria-label={label}
          icon={IconSearch}
          defaultValue={q ?? ""}
          autoComplete="off"
          enterKeyHint="search"
          onKeyDown={event => {
            if (event.key === "Escape" && event.currentTarget.value !== "") {
              event.preventDefault();
              event.currentTarget.value = "";
            }
          }}
        />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </Form>
  );
}
