import {
  IconArrowRight,
  IconArrowUpRight,
  IconSearch,
} from "@tabler/icons-react";
import { forwardRef, useId, type Ref } from "react";
import { WIKI_SEARCH } from "~/constants/navigation";

const SIZES = {
  // 40 px: the header from md.
  md: { input: "h-10", button: "h-8 w-8" },
  // 44 px: the drawer, the search sheet and the home hero.
  lg: { input: "h-11", button: "h-9 w-9" },
} as const;

/**
 * Search (DESIGN §6.26). In FE1 the catalogue isn't here yet, so it is a
 * plain GET form to the original wiki's search, marked as external like any
 * wiki link. It works without JS; the submit button means it works without
 * Enter too. No suggestions, no shortcut.
 */
export const SearchBox = forwardRef(function SearchBox(
  { size }: { size: keyof typeof SIZES },
  ref: Ref<HTMLInputElement>
) {
  const inputId = useId();
  const { input, button } = SIZES[size];
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
          placeholder="Search the original wiki…"
          className={`${input} w-full rounded-full border border-border-strong bg-input-bg pl-10 pr-20 text-body text-fg transition-colors placeholder:text-fg-subtle hover:border-fg-subtle`}
        />
        <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <IconArrowUpRight
            size={14}
            stroke={1.75}
            aria-hidden="true"
            className="text-fg-subtle"
          />
          <button
            type="submit"
            className={`${button} inline-flex items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg`}
          >
            <IconArrowRight size={18} stroke={1.75} aria-hidden="true" />
            <span className="sr-only">
              Search the original wiki (opens original wiki)
            </span>
          </button>
        </span>
      </div>
    </form>
  );
});
