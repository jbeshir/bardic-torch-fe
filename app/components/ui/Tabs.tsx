import { Link as RouterLink } from "react-router";
import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

type View = {
  readonly label: string;
  readonly to: string;
  readonly icon: Icon;
};

const VIEW_TAB =
  "-mb-px inline-flex min-h-11 items-center gap-2 rounded-t-md border-b-3 px-3 text-body-sm focus-visible:-outline-offset-2";
const VIEW_CURRENT = "border-accent font-semibold text-fg";
const VIEW_OTHER =
  "border-transparent font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg";

function ViewLabel({
  view: { label, icon: ViewIcon },
}: {
  readonly view: View;
}) {
  return (
    <>
      <ViewIcon size={18} stroke={1.75} aria-hidden="true" />
      {label}
    </>
  );
}

/**
 * The wiki's page views on the title rule (DESIGN §6.9 a and a′): Read /
 * Edit / History. With two or more views they are links in a "Page views"
 * nav, the current one `aria-current="page"`. With one view there is
 * nothing to choose, so it is the same shape as plain text: no nav, no
 * list, no link, no tab stop. `meta` sits at the right end of the rule
 * from sm; below sm it goes under the rule, which is then drawn under the
 * tabs alone, so the current tab's bar always sits on the rule.
 */
export function ViewTabs({
  views,
  current,
  meta,
}: {
  readonly views: readonly [View, ...View[]];
  /** The `to` of the view being shown. */
  readonly current: string;
  readonly meta?: ReactNode;
}) {
  const [only] = views;
  return (
    <div className="border-border sm:flex sm:items-end sm:justify-between sm:gap-x-4 sm:border-b">
      <div
        data-testid="view-tabs"
        className="shrink-0 border-b border-border sm:border-b-0"
      >
        {views.length === 1 ? (
          <span aria-current="page" className={`${VIEW_TAB} ${VIEW_CURRENT}`}>
            <ViewLabel view={only} />
          </span>
        ) : (
          <nav aria-label="Page views">
            <ul className="flex">
              {views.map(view => (
                <li key={view.to}>
                  <RouterLink
                    to={view.to}
                    prefetch="intent"
                    aria-current={view.to === current ? "page" : undefined}
                    className={`${VIEW_TAB} ${view.to === current ? VIEW_CURRENT : VIEW_OTHER}`}
                  >
                    <ViewLabel view={view} />
                  </RouterLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      {meta ? (
        <div className="py-2.5 text-caption text-fg-subtle">{meta}</div>
      ) : null}
    </div>
  );
}
