import { IconChevronRight } from "@tabler/icons-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useHydrated } from "~/hooks/useHydrated";
import { Link } from "./Link";

type Crumb = {
  readonly label: string;
  readonly to: string;
};

function Chevron() {
  return (
    <span aria-hidden="true" className="separated-list-mark">
      <IconChevronRight size={14} stroke={1.75} />
    </span>
  );
}

/** A trail longer than this (the page included) collapses below sm. */
const MAX_UNCOLLAPSED = 3;

/**
 * Where a page sits (DESIGN §6.19): a "Breadcrumb" nav with an ordered list
 * of links to the ancestors, then the page itself as plain text with
 * `aria-current="page"`. The chevrons between are decorative. Each link has
 * a 24 px tall target (WCAG 2.5.8), and the trail wraps at narrow widths:
 * each chevron leads its item in a `separated-list` (base.css), which hides
 * the one at the start of a line, so none dangles at either end.
 *
 * A trail of more than three items keeps its first ancestor, its parent and
 * the page below sm, with a "…" button ("Show full path") in place of the
 * rest; pressing it shows them all and moves focus to the first one it
 * revealed. Without JS (and before hydration) the full trail wraps instead.
 */
export function Breadcrumbs({
  trail,
  current,
}: {
  /** The ancestors, outermost first: e.g. Help. */
  readonly trail: readonly [Crumb, ...Crumb[]];
  /** The page being shown. */
  readonly current: string;
}) {
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  const firstHiddenRef = useRef<HTMLLIElement>(null);
  const collapsible = hydrated && trail.length + 1 > MAX_UNCOLLAPSED;
  const collapsed = collapsible && !expanded;
  // Only the button expands the trail, and it is gone once it has: focus
  // goes to the first crumb it revealed instead of falling to the page.
  useEffect(() => {
    if (expanded) firstHiddenRef.current?.querySelector("a")?.focus();
  }, [expanded]);
  return (
    <nav aria-label="Breadcrumb">
      <ol
        role="list"
        className="separated-list separated-list-tight gap-y-2 text-caption"
      >
        {trail.map(({ label, to }, index) => {
          const middle = index > 0 && index < trail.length - 1;
          return (
            <Fragment key={to}>
              {index === 1 && collapsed ? (
                <li className="sm:hidden">
                  <Chevron />
                  <button
                    type="button"
                    aria-label="Show full path"
                    aria-expanded="false"
                    onClick={() => setExpanded(true)}
                    className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm text-link hover:text-link-hover"
                  >
                    …
                  </button>
                </li>
              ) : null}
              <li
                ref={index === 1 ? firstHiddenRef : undefined}
                className={middle && collapsed ? "max-sm:hidden" : undefined}
              >
                <Chevron />
                <Link to={to} appearance="plain" compact>
                  {label}
                </Link>
              </li>
            </Fragment>
          );
        })}
        <li>
          <Chevron />
          <span
            aria-current="page"
            className="inline-flex min-h-6 items-center text-fg-muted"
          >
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
