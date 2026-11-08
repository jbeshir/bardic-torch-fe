import { IconSearch } from "@tabler/icons-react";
import { useId, type Ref } from "react";
import { Form } from "react-router";
import { useCanonicalSubmit } from "~/components/catalogue/canonical-form";
import { searchQuery } from "~/catalogue/query-state";
import { SEARCH } from "~/constants/navigation";

const SIZES = {
  // 40 px: the header from md. The field is narrow until lg, so the
  // placeholder is short there; from lg it is replaced by the long one (the
  // hint below). The 32 px submit's hit area is padded to 44 px below lg.
  md: {
    input: "h-10 pr-11 lg:placeholder:text-transparent",
    button:
      "right-1 h-8 w-8 before:absolute before:-inset-1.5 lg:before:hidden",
    placeholder: "Search…",
  },
  // 44 px: the drawer, the search sheet, the home hero and the search page;
  // a 44 px submit.
  lg: {
    input: "h-11 pr-12",
    button: "right-0 h-11 w-11",
    placeholder: "Search pieces and bards…",
  },
} as const;

/**
 * Search (DESIGN §6.26): a GET form to the catalogue's search page,
 * `/search?q=`. With JS it goes straight to the canonical URL (the search
 * trimmed, one request); without JS the browser sends `q`, which the page
 * answers the same. The submit button means it works without Enter too.
 * No suggestions, no shortcut. `defaultValue` prefills it (the search
 * page's own box). Its search landmark is named by `label`, so the site's
 * box and a page's own read differently in a landmark list.
 */
export function SearchBox({
  size,
  defaultValue,
  label = "Site search",
  ref,
}: {
  readonly size: keyof typeof SIZES;
  readonly defaultValue?: string | undefined;
  /** The search landmark's name: the site's box unless a page names its own. */
  readonly label?: string;
  readonly ref?: Ref<HTMLInputElement>;
}) {
  const inputId = useId();
  const onSubmit = useCanonicalSubmit(searchQuery);
  const { input, button, placeholder } = SIZES[size];
  const longPlaceholder = SIZES.lg.placeholder;
  return (
    <Form
      role="search"
      aria-label={label}
      method="get"
      action={SEARCH.action}
      onSubmit={onSubmit}
    >
      <label htmlFor={inputId} className="sr-only">
        Search the catalogue
      </label>
      <div className="relative">
        <IconSearch
          size={18}
          stroke={1.75}
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          ref={ref}
          id={inputId}
          type="search"
          name={SEARCH.param}
          defaultValue={defaultValue}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          className={`${input} peer w-full rounded-full border border-border-strong bg-input-bg pl-10 text-body text-fg transition-colors placeholder:text-fg-subtle hover:border-fg-subtle`}
        />
        {placeholder === longPlaceholder ? null : (
          // A placeholder can't change with the width: from lg, while the
          // field is empty, the long one is drawn over the hidden short one.
          <span
            aria-hidden="true"
            data-testid="search-long-placeholder"
            className="pointer-events-none absolute inset-y-0 left-10 right-11 hidden items-center truncate text-body text-fg-subtle lg:peer-placeholder-shown:flex"
          >
            {longPlaceholder}
          </span>
        )}
        {/* The hover wash is see-through, so it shows on the field's own
            fill in both themes (surface-sunken would vanish on dark's well). */}
        <button
          type="submit"
          className={`${button} absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg-10 hover:text-fg`}
        >
          <IconSearch size={18} stroke={1.75} aria-hidden="true" />
          <span className="sr-only">Search</span>
        </button>
      </div>
    </Form>
  );
}
