import { IconArrowUpRight, IconSearch } from "@tabler/icons-react";
import { useId, type Ref } from "react";
import { WIKI_SEARCH } from "~/constants/navigation";

const SIZES = {
  // 40 px: the header from md. The field is narrow until lg, so the
  // placeholder is short there; from lg it is replaced by the long one (the
  // hint below). The 32 px submit's hit area is padded to 44 px below lg.
  md: {
    input: "h-10 pr-11 lg:placeholder:text-transparent",
    button:
      "right-1 h-8 w-8 before:absolute before:-inset-1.5 lg:before:hidden",
    placeholder: "Search the wiki…",
  },
  // 44 px: the drawer, the search sheet and the home hero; a 44 px submit.
  lg: {
    input: "h-11 pr-12",
    button: "right-0 h-11 w-11",
    placeholder: "Search the original wiki…",
  },
} as const;

/**
 * Search (DESIGN §6.26). In FE1 the catalogue isn't here yet, so it is a
 * plain GET form to the original wiki's search, marked as external like any
 * wiki link: its submit button carries the wiki mark (↗) and says where it
 * goes. It works without JS; the submit button means it works without
 * Enter too. No suggestions, no shortcut.
 */
export function SearchBox({
  size,
  ref,
}: {
  readonly size: keyof typeof SIZES;
  readonly ref?: Ref<HTMLInputElement>;
}) {
  const inputId = useId();
  const { input, button, placeholder } = SIZES[size];
  const longPlaceholder = SIZES.lg.placeholder;
  return (
    <form role="search" method="get" action={WIKI_SEARCH.action}>
      <label htmlFor={inputId} className="sr-only">
        Search the original wiki
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
          name={WIKI_SEARCH.param}
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
          className={`${button} absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg`}
        >
          <IconArrowUpRight size={18} stroke={1.75} aria-hidden="true" />
          <span className="sr-only">
            Search the original wiki (opens original wiki)
          </span>
        </button>
      </div>
    </form>
  );
}
