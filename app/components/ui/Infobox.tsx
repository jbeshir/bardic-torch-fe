import { IconAlertCircle } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { Skeleton, SkeletonRegion } from "./Skeleton";

type InfoboxRow = {
  /** Keys the row when its label may repeat (two "Words" credits). */
  readonly id?: string;
  readonly label: string;
  /** null when nothing is recorded: shown as a dash, read as "Not recorded". */
  readonly value: ReactNode | null;
};

type InfoboxSection = {
  readonly heading: string;
  readonly rows: readonly InfoboxRow[];
};

// The label sits beside its value where the box is wide: full width (sm
// to md) and the wider float from xl. In the md–xl float it sits above.
const ROW =
  "border-b border-border py-2 last:border-b-0 sm:grid sm:grid-cols-infobox sm:gap-x-3 md:block xl:grid";

/**
 * The parts of a list of facts, for facts written as content (a help page's
 * `:::infobox`, whose labels may be links): the list, a row, and the row's
 * label and value. `sections` uses the same parts.
 */
export function InfoboxFacts({ children }: { readonly children: ReactNode }) {
  return <dl className="mt-1 text-body-sm">{children}</dl>;
}

export function InfoboxFact({ children }: { readonly children: ReactNode }) {
  return <div className={ROW}>{children}</div>;
}

export function InfoboxFactLabel({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <dt className="text-fg-muted">{children}</dt>;
}

export function InfoboxFactValue({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <dd className="min-w-0 wrap-anywhere text-fg">{children}</dd>;
}

function Rows({ rows }: { readonly rows: readonly InfoboxRow[] }) {
  return (
    <InfoboxFacts>
      {rows.map(({ id, label, value }) => (
        <InfoboxFact key={id ?? label}>
          <InfoboxFactLabel>{label}</InfoboxFactLabel>
          <InfoboxFactValue>
            {value ?? (
              <>
                <span aria-hidden="true" className="text-fg-subtle">
                  —
                </span>
                <span className="sr-only">Not recorded</span>
              </>
            )}
          </InfoboxFactValue>
        </InfoboxFact>
      ))}
    </InfoboxFacts>
  );
}

function LoadingRows() {
  return (
    <SkeletonRegion label="these details">
      <div className="mt-1 text-body-sm">
        {(["full", "most", "part"] as const).map(width => (
          <div key={width} className={ROW}>
            <Skeleton width="most" />
            <Skeleton width={width} />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * The facts box at the side of a page (DESIGN §6.10): an aside named by its
 * title. The title is an h2 styled as h3, because the box comes before the
 * page's first prose h2; each section has an h3 and a definition list.
 * Sections with no rows are left out. Floats right from md and stacks full
 * width above the prose below md (§5.5); put it first in the content.
 *
 * `loading` shows skeleton rows (client transitions only); `error` replaces
 * the rows with a danger line and the retry control you pass. Facts with
 * no section heading (a help page's "At a glance") are `children`, built
 * from InfoboxFacts.
 */
export function Infobox({
  title,
  subtitle,
  sections = [],
  children,
  footer,
  loading = false,
  error,
}: {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly sections?: readonly InfoboxSection[];
  /** Facts outside any section: an InfoboxFacts list. */
  readonly children?: ReactNode;
  /** An action under the facts, e.g. "Help complete this page". */
  readonly footer?: ReactNode;
  readonly loading?: boolean;
  /** Shown instead of the facts when they failed: a "Try again" control. */
  readonly error?: { retry: ReactNode };
}) {
  const titleId = useId();
  const filled = sections.filter(({ rows }) => rows.length > 0);
  return (
    <aside
      aria-labelledby={titleId}
      className="mb-6 rounded-lg border border-t-3 border-border border-t-accent bg-surface-raised p-4 shadow-1 md:float-right md:clear-right md:ml-8 md:w-infobox xl:w-infobox-xl"
    >
      <h2 id={titleId} className="text-h3">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-caption text-fg-muted">{subtitle}</p>
      ) : null}
      {loading ? <LoadingRows /> : null}
      {error && !loading ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-body-sm text-danger-fg">
          <IconAlertCircle
            size={18}
            stroke={1.75}
            aria-hidden="true"
            className="shrink-0 text-danger-icon"
          />
          <span>We couldn’t load these details.</span>
          {error.retry}
        </p>
      ) : null}
      {!loading && !error
        ? filled.map(section => (
            <section key={section.heading} className="mt-4">
              <h3 className="font-sans text-label-caps uppercase text-fg-subtle">
                {section.heading}
              </h3>
              <Rows rows={section.rows} />
            </section>
          ))
        : null}
      {!loading && !error ? children : null}
      {footer ? (
        <div className="mt-4 border-t border-border pt-3 text-body-sm">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
