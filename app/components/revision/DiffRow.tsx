import { useId, type ReactNode } from "react";
import type { DiffRow as Row } from "~/catalogue/diff";

/** A value as written, wrapping as it is; "—" for none. */
function Text({ text }: { readonly text: string | null }) {
  if (text === null || text === "") {
    return <span className="text-fg-subtle">—</span>;
  }
  return <span className="wrap-anywhere whitespace-pre-wrap">{text}</span>;
}

const TONES = {
  Added: "bg-success-bg text-success-fg",
  Removed: "bg-danger-bg text-danger-fg",
  Changed: "bg-surface-sunken text-fg",
} as const;

/** A list item, with the word for what happened to it (never colour alone). */
function Item({
  change,
  children,
}: {
  readonly change: keyof typeof TONES | null;
  readonly children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {change ? (
        <span
          className={`shrink-0 rounded-sm px-1.5 text-caption font-semibold ${TONES[change]}`}
        >
          {change}
        </span>
      ) : null}
      <span className="wrap-anywhere">{children}</span>
    </li>
  );
}

/**
 * One changed field of a revision (plan §4.11): its label, then its text
 * before and after, or for a list the items added, removed and changed.
 * With no base, the value alone.
 */
export function DiffRow({
  row,
  first,
}: {
  readonly row: Row;
  /** The revision has no base: show what it set. */
  readonly first: boolean;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="border-b border-border py-4 last:border-b-0"
    >
      <h3 id={headingId} className="mb-2 text-body font-semibold text-fg">
        {row.label}
      </h3>
      {row.kind === "value" ? (
        <dl className="grid gap-3 text-body-sm text-fg sm:grid-cols-2">
          {first ? null : (
            <div>
              <dt className="text-caption font-semibold text-fg-muted">
                Before
              </dt>
              <dd className="mt-1">
                <Text text={row.before} />
              </dd>
            </div>
          )}
          <div>
            <dt className="text-caption font-semibold text-fg-muted">
              {first ? "Value" : "After"}
            </dt>
            <dd className="mt-1">
              <Text text={row.after} />
            </dd>
          </div>
        </dl>
      ) : (
        <ul role="list" className="grid gap-2 text-body-sm text-fg">
          {row.added.map(item => (
            <Item key={item} change={first ? null : "Added"}>
              {item}
            </Item>
          ))}
          {row.removed.map(item => (
            <Item key={item} change="Removed">
              {item}
            </Item>
          ))}
          {row.changed.map(({ before, after }) => (
            <Item key={after} change="Changed">
              {before} → {after}
            </Item>
          ))}
        </ul>
      )}
    </section>
  );
}
