import { Link as RouterLink } from "react-router";
import type { Icon } from "@tabler/icons-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useHydrated } from "~/hooks/useHydrated";

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

type Panel = {
  readonly label: string;
  readonly content: ReactNode;
};

/**
 * An in-page tablist (DESIGN §6.9 b), segmented so it doesn't look like the
 * page views. Arrow keys move and activate (panels are cheap), Home and End
 * jump, Tab goes into the panel. Without JS (and until hydration) the
 * tablist is hidden and every panel is shown in turn under its heading.
 *
 * `lazy` is for panels too heavy to keep in the page all at once (the
 * styleguide's whole-gallery previews): only the selected panel's content
 * is rendered (the others stay as empty hidden tabpanels, so every tab's
 * `aria-controls` resolves), and without JS only the default panel is shown.
 */
export function Tabs({
  label,
  panels,
  defaultIndex = 0,
  headingLevel = 3,
  lazy = false,
}: {
  /** The tablist's accessible name. */
  readonly label: string;
  readonly panels: readonly [Panel, ...Panel[]];
  readonly defaultIndex?: number;
  /** The level of the panel headings shown without JS. */
  readonly headingLevel?: 2 | 3;
  /** Render only the selected panel, and only the default one without JS. */
  readonly lazy?: boolean;
}) {
  const id = useId();
  const enhanced = useHydrated();
  const [selected, setSelected] = useState(defaultIndex);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const chosenRef = useRef(false);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  // Focus stays on the tab the user chose, even when the panel it mounts
  // focuses something of its own (an ErrorState heading in the styleguide):
  // this effect runs after the panel's own effects.
  useEffect(() => {
    if (!chosenRef.current) return;
    chosenRef.current = false;
    tabsRef.current[selected]?.focus();
  }, [selected]);

  function select(index: number) {
    chosenRef.current = true;
    setSelected(index);
    tabsRef.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = panels.length - 1;
    const next = {
      ArrowRight: selected === last ? 0 : selected + 1,
      ArrowLeft: selected === 0 ? last : selected - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div data-enhanced={enhanced || undefined}>
      <div
        role="tablist"
        aria-label={label}
        hidden={!enhanced}
        // A display utility would beat the `hidden` attribute, so swap it.
        className={`${enhanced ? "inline-flex" : "hidden"} max-w-full flex-wrap gap-1 rounded-lg bg-surface-sunken p-1`}
      >
        {panels.map((panel, index) => (
          <button
            key={panel.label}
            ref={element => {
              tabsRef.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === selected}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={onKeyDown}
            className="min-h-9 rounded-md border border-transparent px-3 text-body-sm font-medium text-fg-muted transition-colors hover:text-fg aria-selected:border-border-strong aria-selected:bg-surface-raised aria-selected:text-fg aria-selected:shadow-1"
          >
            {panel.label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) =>
        enhanced ? (
          <div
            key={panel.label}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            tabIndex={0}
            hidden={index !== selected}
            className="mt-4 rounded-lg"
          >
            {lazy && index !== selected ? null : panel.content}
          </div>
        ) : lazy && index !== defaultIndex ? null : (
          <section
            key={panel.label}
            aria-labelledby={`${id}-heading-${index}`}
            className="mt-6 first-of-type:mt-0"
          >
            <Heading
              id={`${id}-heading-${index}`}
              className="mb-3 font-sans text-h4"
            >
              {panel.label}
            </Heading>
            {panel.content}
          </section>
        )
      )}
    </div>
  );
}
