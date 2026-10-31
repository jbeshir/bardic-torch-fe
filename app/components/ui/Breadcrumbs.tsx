import { Link as RemixLink } from "@remix-run/react";
import { IconChevronRight } from "@tabler/icons-react";

type Crumb = {
  readonly label: string;
  readonly to: string;
};

/**
 * Where a page sits (DESIGN §6.19): a "Breadcrumb" nav with an ordered list
 * of links to the ancestors, then the page itself as plain text with
 * `aria-current="page"`. The chevrons between are decorative. Each link has
 * a 24 px tall target (WCAG 2.5.8), and the trail wraps at narrow widths.
 */
export function Breadcrumbs({
  trail,
  current,
}: {
  /** The ancestors, outermost first: e.g. Help. */
  trail: readonly [Crumb, ...Crumb[]];
  /** The page being shown. */
  current: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        role="list"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 text-caption"
      >
        {trail.map(({ label, to }) => (
          <li key={to} className="flex items-center gap-x-1">
            <RemixLink
              to={to}
              prefetch="intent"
              className="inline-flex min-h-6 items-center rounded-sm text-link no-underline underline-offset-prose hover:text-link-hover hover:underline"
            >
              {label}
            </RemixLink>
            <IconChevronRight
              size={14}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-fg-subtle"
            />
          </li>
        ))}
        <li className="flex items-center">
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
