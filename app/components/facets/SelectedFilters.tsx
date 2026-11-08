import { IconX } from "@tabler/icons-react";
import { useId } from "react";
import { Link as RouterLink } from "react-router";

type Chip = {
  /** What the chip removes: "Search: ‘kettle’", "Letter: W". */
  readonly label: string;
  /** The list without this value. */
  readonly href: string;
};

const CHIP =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-sunken pl-3 pr-2 text-body-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-accent-subtle lg:min-h-8";

/**
 * The filters a list is narrowed by (plan §2.3), above its results: one
 * chip per value, each a link to the list without it ("Letter: W ✕"),
 * then "Clear all". They are `rel="nofollow"`: every chip names another
 * filter combination, which crawlers needn't walk. Nothing selected,
 * nothing shown.
 */
export function SelectedFilters({
  chips,
  clearHref,
}: {
  readonly chips: readonly Chip[];
  /** The list with no filters at all. */
  readonly clearHref: string;
}) {
  const headingId = useId();
  if (chips.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        Selected filters
      </h2>
      <ul role="list" className="flex flex-wrap items-center gap-2">
        {chips.map(chip => (
          <li key={chip.href} className="flex">
            <RouterLink
              to={chip.href}
              rel="nofollow"
              prefetch="intent"
              className={CHIP}
            >
              <span>
                <span className="sr-only">Remove </span>
                {chip.label}
              </span>
              <IconX
                size={16}
                stroke={1.75}
                aria-hidden="true"
                className="shrink-0 text-fg-muted"
              />
            </RouterLink>
          </li>
        ))}
        <li className="flex">
          <RouterLink
            to={clearHref}
            rel="nofollow"
            prefetch="intent"
            className="inline-flex min-h-9 items-center rounded-sm px-1 text-body-sm font-medium text-link hover:text-link-hover hover:underline lg:min-h-8"
          >
            Clear all
          </RouterLink>
        </li>
      </ul>
    </section>
  );
}
