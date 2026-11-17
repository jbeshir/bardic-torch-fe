import { Link as RouterLink, useLocation } from "react-router";
import { ButtonLink } from "~/components/ui/Button";
import { CONTRIBUTE_HREF, NAV_GROUPS } from "~/constants/navigation";
import { LogoMark } from "./LogoMark";

// 44 px rows below lg; 28 px at lg (pointer screens, WCAG 2.5.8), so the
// whole Help group fits above the fold of an 800 px window, clear of the
// "more below" fade, with room for labels to wrap in a wider sans.
// The rows, headings and gaps don't depend on the font;
// only a label that wraps adds a line to its row.
const ITEM =
  "flex min-h-11 items-center gap-2 rounded-md px-3 text-body-sm transition-colors focus-visible:-outline-offset-2 lg:min-h-7";
const ITEM_IDLE = "text-fg-muted hover:bg-surface-sunken hover:text-fg";
const ITEM_CURRENT =
  "bg-accent-subtle font-semibold text-accent-text shadow-current-bar";

function NavItem({
  label,
  href,
  current,
}: {
  readonly label: string;
  readonly href: string;
  /** "page" for the page shown, "true" for the section it is in. */
  readonly current: "page" | "true" | false;
}) {
  return (
    <RouterLink
      to={href}
      prefetch="intent"
      aria-current={current === false ? undefined : current}
      className={`${ITEM} ${current === false ? ITEM_IDLE : ITEM_CURRENT}`}
    >
      {label}
    </RouterLink>
  );
}

/**
 * Whether the nav entry at `href` is the section being shown. An entry
 * marks its whole section: `/pieces` is current on `/pieces/the-copper-kettle`
 * and its history. An entry with a query (`/categories?facet=mood`) is
 * current only for that query, and `/categories` is not current while a
 * facet is picked, so one entry per page is. Only the page itself is
 * `aria-current="page"`; the section of a page inside it is `"true"`.
 */
function isCurrent(
  href: string,
  pathname: string,
  search: string
): "page" | "true" | false {
  const [path = "", query = ""] = href.split("?");
  const wanted = new URLSearchParams(query).get("facet");
  const facet = new URLSearchParams(search).get("facet");
  if (wanted !== null) {
    return pathname === path && facet === wanted ? "page" : false;
  }
  if (pathname === path) return facet === null ? "page" : false;
  // A page inside the section: the entry is its section, not the page.
  return pathname.startsWith(`${path}/`) ? "true" : false;
}

/**
 * The site navigation's contents, from
 * app/constants/navigation.ts: Browse, the facets, Help, then the
 * ContributeCard. The caller wraps it in the "Site"
 * nav: the persistent sidebar from lg, or the drawer below.
 */
export function Sidebar() {
  const { pathname, search } = useLocation();
  // One wrapper, so the first group (first:mt-0) starts flush with the
  // nav whatever the caller puts before it.
  return (
    <div>
      {NAV_GROUPS.map(({ heading, items }) => (
        <div key={heading} className="mt-6 first:mt-0 lg:mt-5">
          <h3 className="mb-2 px-3 font-sans text-label-caps uppercase text-fg-subtle lg:mb-1">
            {heading}
          </h3>
          <ul role="list">
            {items.map(item => (
              <li key={item.href}>
                <NavItem
                  {...item}
                  current={isCurrent(item.href, pathname, search)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-8 rounded-lg border border-border bg-surface p-4">
        <LogoMark className="h-5 w-5" />
        <h3 className="mt-2 font-sans text-h4 text-fg">Keep the torch lit</h3>
        <p className="mt-1 text-body-sm text-fg-muted">
          Anyone can add a piece, a link or a performance.
        </p>
        <div className="mt-3">
          <ButtonLink to={CONTRIBUTE_HREF} size="sm" fullWidth>
            Start contributing
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
