import { Link as RemixLink } from "@remix-run/react";
import type { Icon } from "@tabler/icons-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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

function ViewLabel({ view: { label, icon: ViewIcon } }: { view: View }) {
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
 * list, no link, no tab stop. `meta` sits at the right end of the rule.
 */
export function ViewTabs({
  views,
  current,
  meta,
}: {
  views: readonly [View, ...View[]];
  /** The `to` of the view being shown. */
  current: string;
  meta?: ReactNode;
}) {
  const [only] = views;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-border">
      {views.length === 1 ? (
        <span aria-current="page" className={`${VIEW_TAB} ${VIEW_CURRENT}`}>
          <ViewLabel view={only} />
        </span>
      ) : (
        <nav aria-label="Page views">
          <ul className="flex">
            {views.map(view => (
              <li key={view.to}>
                <RemixLink
                  to={view.to}
                  prefetch="intent"
                  aria-current={view.to === current ? "page" : undefined}
                  className={`${VIEW_TAB} ${view.to === current ? VIEW_CURRENT : VIEW_OTHER}`}
                >
                  <ViewLabel view={view} />
                </RemixLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
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
 */
export function Tabs({
  label,
  panels,
  defaultIndex = 0,
  headingLevel = 3,
}: {
  /** The tablist's accessible name. */
  label: string;
  panels: readonly [Panel, ...Panel[]];
  defaultIndex?: number;
  /** The level of the panel headings shown without JS. */
  headingLevel?: 2 | 3;
}) {
  const id = useId();
  const [enhanced, setEnhanced] = useState(false);
  const [selected, setSelected] = useState(defaultIndex);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  useEffect(() => setEnhanced(true), []);

  function select(index: number) {
    setSelected(index);
    tabs.current[index]?.focus();
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
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === selected}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={onKeyDown}
            className="min-h-9 rounded-md border border-transparent px-3 text-body-sm font-medium text-fg-muted transition-colors hover:text-fg aria-selected:border-border aria-selected:bg-surface-raised aria-selected:text-fg aria-selected:shadow-1"
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
            {panel.content}
          </div>
        ) : (
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
