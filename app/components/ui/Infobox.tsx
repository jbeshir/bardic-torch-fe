import { IconAlertCircle } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { Skeleton, SkeletonRegion } from "./Skeleton";

type InfoboxRow = {
  readonly label: string;
  /** null when nothing is recorded: shown as a dash, read as "Not recorded". */
  readonly value: ReactNode | null;
};

type InfoboxSection = {
  readonly heading: string;
  readonly rows: readonly InfoboxRow[];
};

const ROW =
  "border-b border-border py-2 last:border-b-0 sm:grid sm:grid-cols-infobox sm:gap-x-3";

function Rows({ rows }: { rows: readonly InfoboxRow[] }) {
  return (
    <dl className="mt-1 text-body-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className={ROW}>
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-fg">
            {value ?? (
              <>
                <span aria-hidden="true" className="text-fg-subtle">
                  —
                </span>
                <span className="sr-only">Not recorded</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
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
 * the rows with a danger line and the retry control you pass.
 */
export function Infobox({
  title,
  subtitle,
  sections,
  footer,
  loading = false,
  error,
}: {
  title: string;
  subtitle?: ReactNode;
  sections: readonly InfoboxSection[];
  /** An action under the facts, e.g. "Help complete this page". */
  footer?: ReactNode;
  loading?: boolean;
  /** Shown instead of the facts when they failed: a "Try again" control. */
  error?: { retry: ReactNode };
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
          <span>Couldn&apos;t load these details.</span>
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
      {footer ? (
        <div className="mt-4 border-t border-border pt-3 text-body-sm">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
