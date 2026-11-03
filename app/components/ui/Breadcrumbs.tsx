import { IconChevronRight } from "@tabler/icons-react";
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

/**
 * Where a page sits (DESIGN §6.19): a "Breadcrumb" nav with an ordered list
 * of links to the ancestors, then the page itself as plain text with
 * `aria-current="page"`. The chevrons between are decorative. Each link has
 * a 24 px tall target (WCAG 2.5.8), and the trail wraps at narrow widths:
 * each chevron leads its item in a `separated-list` (base.css), which hides
 * the one at the start of a line, so none dangles at either end.
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
  return (
    <nav aria-label="Breadcrumb">
      <ol
        role="list"
        className="separated-list separated-list-tight gap-y-2 text-caption"
      >
        {trail.map(({ label, to }) => (
          <li key={to}>
            <Chevron />
            <Link to={to} appearance="plain" compact>
              {label}
            </Link>
          </li>
        ))}
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
