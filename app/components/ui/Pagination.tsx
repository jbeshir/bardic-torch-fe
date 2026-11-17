import { Link as RouterLink } from "react-router";
import {
  IconChevronLeft,
  IconChevronRight,
  type Icon,
} from "@tabler/icons-react";

/** A page number, or a gap in the run of numbers before page `before`. */
type Item = number | { readonly before: number };

/**
 * The page numbers to show: the first, the last, and the current one with
 * its neighbours, with a gap where numbers are left out. A gap never
 * stands for a single page; that page is shown instead.
 */
function pageItems(page: number, pageCount: number): Item[] {
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...shown]
    .filter(n => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((n, index) => {
    const previous = pages[index - 1];
    if (previous === undefined || n - previous === 1) return [n];
    if (n - previous === 2) return [n - 1, n];
    return [{ before: n }, n];
  });
}

const ITEM =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-body-sm";
const LINK = `${ITEM} font-medium text-link transition-colors hover:bg-surface-sunken hover:text-link-hover`;

function Step({
  to,
  label,
  icon: StepIcon,
  rel,
  trailing = false,
}: {
  readonly to: string | null;
  readonly label: string;
  readonly icon: Icon;
  readonly rel: "prev" | "next";
  readonly trailing?: boolean;
}) {
  const content = (
    <>
      {trailing ? label : null}
      <StepIcon
        size={18}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0"
      />
      {trailing ? null : label}
    </>
  );
  if (to === null) {
    // The first or last page: nothing to go to, so not a link. No fill:
    // it mustn't outweigh the live steps, or look like their hover.
    return (
      <span
        aria-disabled="true"
        className={`${ITEM} cursor-not-allowed gap-1 font-medium text-fg-subtle`}
      >
        {content}
      </span>
    );
  }
  return (
    <RouterLink to={to} rel={rel} prefetch="intent" className={`${LINK} gap-1`}>
      {content}
    </RouterLink>
  );
}

/**
 * Pages of a long list: a "Pagination" nav of links to
 * `href(n)`. The current page is not a link (`aria-current="page"`, on the
 * accent fill, never focused, so no ring is drawn on accent). Below sm the
 * numbers give way to "Page 3 of 12". Previous on the first page and Next
 * on the last are shown disabled, as text.
 */
export function Pagination({
  page,
  pageCount,
  href,
}: {
  /** The current page, from 1. */
  readonly page: number;
  readonly pageCount: number;
  /** The address of page `n`, e.g. `?page=n` on the same path. */
  readonly href: (n: number) => string;
}) {
  return (
    <nav aria-label="Pagination">
      <ul role="list" className="flex flex-wrap items-center gap-1">
        <li>
          <Step
            to={page > 1 ? href(page - 1) : null}
            label="Previous"
            icon={IconChevronLeft}
            rel="prev"
          />
        </li>
        {pageItems(page, pageCount).map(item =>
          typeof item === "object" ? (
            <li key={`gap-${item.before}`} className="hidden sm:block">
              <span className={`${ITEM} text-fg-subtle`}>
                <span aria-hidden="true">…</span>
                <span className="sr-only">more pages</span>
              </span>
            </li>
          ) : (
            <li key={item} className="hidden sm:block">
              {item === page ? (
                <span
                  aria-current="page"
                  className={`${ITEM} bg-accent font-semibold text-accent-fg`}
                >
                  <span className="sr-only">Page </span>
                  {item}
                </span>
              ) : (
                <RouterLink to={href(item)} prefetch="intent" className={LINK}>
                  <span className="sr-only">Page </span>
                  {item}
                </RouterLink>
              )}
            </li>
          )
        )}
        <li className="px-2 text-body-sm text-fg-muted sm:hidden">
          Page {page} of {pageCount}
        </li>
        <li>
          <Step
            to={page < pageCount ? href(page + 1) : null}
            label="Next"
            icon={IconChevronRight}
            rel="next"
            trailing
          />
        </li>
      </ul>
    </nav>
  );
}
