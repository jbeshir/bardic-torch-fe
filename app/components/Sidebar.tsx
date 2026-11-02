import { Link as RouterLink, useLocation } from "react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { ButtonLink } from "~/components/ui/Button";
import { EXTERNAL_MARKS, externalKind } from "~/components/ui/Link";
import { CONTRIBUTE_HREF, NAV_GROUPS } from "~/constants/navigation";
import { LogoMark } from "./LogoMark";

// 44 px rows below lg; 32 px at lg (pointer screens, WCAG 2.5.8), so the
// Help group fits above the fold of an 800 px window.
const ITEM =
  "group flex min-h-11 items-center gap-2 rounded-md px-3 text-body-sm transition-colors focus-visible:-outline-offset-2 lg:min-h-8";
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
  readonly current: boolean;
}) {
  const kind = externalKind(href);
  if (kind) {
    const { icon: MarkIcon, suffix } = EXTERNAL_MARKS[kind];
    // Same tab: the hidden text says where it goes, not how it opens.
    return (
      <a href={href} rel="noopener" className={`${ITEM} ${ITEM_IDLE}`}>
        {label}
        <MarkIcon
          size={14}
          stroke={1.75}
          aria-hidden="true"
          className="ml-auto shrink-0 text-fg-subtle group-hover:text-accent-text motion-safe:transition-transform motion-safe:duration-fast motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
        />
        <span className="sr-only">{suffix}</span>
      </a>
    );
  }
  return (
    <RouterLink
      to={href}
      prefetch="intent"
      aria-current={current ? "page" : undefined}
      className={`${ITEM} ${current ? ITEM_CURRENT : ITEM_IDLE}`}
    >
      {label}
    </RouterLink>
  );
}

/**
 * The site navigation's contents (DESIGN §5.3), from
 * app/constants/navigation.ts: Browse with its note about the wiki, the
 * facets, Help, then the ContributeCard. The caller wraps it in the "Site"
 * nav: the persistent sidebar from lg, or the drawer below.
 */
export function Sidebar() {
  const { pathname } = useLocation();
  // One wrapper, so the first group (first:mt-0) starts flush with the
  // nav whatever the caller puts before it.
  return (
    <div>
      {NAV_GROUPS.map(({ heading, note, items }) => (
        <div key={heading} className="mt-6 first:mt-0 lg:mt-5">
          <h3 className="mb-2 px-3 font-sans text-label-caps uppercase text-fg-subtle lg:mb-1">
            {heading}
          </h3>
          {note ? (
            <p className="mb-2 flex gap-2 rounded-lg bg-surface-sunken p-3 text-caption text-fg-muted lg:p-2.5">
              <IconInfoCircle
                size={16}
                stroke={1.75}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-info-icon"
              />
              {note}
            </p>
          ) : null}
          <ul role="list">
            {items.map(item => (
              <li key={item.href}>
                <NavItem {...item} current={item.href === pathname} />
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
