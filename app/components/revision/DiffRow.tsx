import {
  IconMinus,
  IconPencil,
  IconPlus,
  type Icon,
} from "@tabler/icons-react";
import { Fragment, useId, type ReactNode } from "react";
import { UserLink } from "~/components/catalogue/UserLink";
import { Link } from "~/components/ui/Link";
import type { DiffItem, DiffRow as Row, DiffValue } from "~/catalogue/diff";
import type { WordPart } from "~/catalogue/word-diff";

function Value({ value }: { readonly value: DiffValue }) {
  switch (value.kind) {
    case "text":
      return value.text;
    case "internal":
      return (
        <Link to={value.to} appearance="prose">
          {value.text}
        </Link>
      );
    case "external":
      return <UserLink url={value.url}>{value.text}</UserLink>;
  }
}

/** A value's parts, " · " between them; "—" for none. */
function Parts({ parts }: { readonly parts: readonly DiffValue[] | null }) {
  if (parts === null || parts.length === 0) {
    return <span className="text-fg-subtle">—</span>;
  }
  const seen = new Map<string, number>();
  return parts.map((part, index) => {
    // A part is keyed by what it shows, and its repeat.
    const name = `${part.kind}:${part.text}`;
    const repeat = seen.get(name) ?? 0;
    seen.set(name, repeat + 1);
    return (
      <Fragment key={`${repeat}:${name}`}>
        {index > 0 ? " · " : null}
        <Value value={part} />
      </Fragment>
    );
  });
}

const MARKS = {
  added: {
    icon: IconPlus,
    word: "Added",
    tone: "bg-success-bg text-success-fg",
  },
  removed: {
    icon: IconMinus,
    word: "Removed",
    tone: "bg-danger-bg text-danger-fg",
  },
  changed: {
    icon: IconPencil,
    word: "Changed",
    tone: "bg-surface-sunken text-fg",
  },
} as const satisfies Readonly<
  Record<string, { icon: Icon; word: string; tone: string }>
>;

/** What happened to an item: an icon and its word, never colour alone. */
function Mark({ change }: { readonly change: keyof typeof MARKS }) {
  const { icon: MarkIcon, word, tone } = MARKS[change];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 text-caption font-semibold ${tone}`}
    >
      <MarkIcon size={14} stroke={1.75} aria-hidden="true" />
      {word}
    </span>
  );
}

function Item({
  change,
  children,
}: {
  readonly change: keyof typeof MARKS | null;
  readonly children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {change ? <Mark change={change} /> : null}
      <span>{children}</span>
    </li>
  );
}

/** Before and after, side by side from sm; or the value alone. */
function Sides({
  before,
  after,
  first,
}: {
  readonly before: ReactNode;
  readonly after: ReactNode;
  readonly first: boolean;
}) {
  if (first) return <div className="text-body-sm text-fg">{after}</div>;
  return (
    <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
      <div>
        <dt className="text-caption font-semibold text-fg-muted">Before</dt>
        <dd className="mt-1 text-fg">{before}</dd>
      </div>
      <div>
        <dt className="text-caption font-semibold text-fg-muted">After</dt>
        <dd className="mt-1 text-fg">{after}</dd>
      </div>
    </dl>
  );
}

/** Markdown source as written, in a block; "—" for none. */
function TextBlock({ text }: { readonly text: string | null }) {
  if (text === null || text === "") {
    return <span className="text-fg-subtle">—</span>;
  }
  return (
    <div className="wrap-anywhere whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 font-mono text-body-sm">
      {text}
    </div>
  );
}

const itemKey = (item: DiffItem) => item.key;

/**
 * A text field's change word by word, in one block of its source: what
 * was removed struck through on the danger fill, what was added on the
 * success fill, each with its icon and a hidden "removed:" or "added:",
 * so colour is never alone.
 */
/** Each part with where it starts in the merged text, its key. */
function placed(
  parts: readonly WordPart[]
): readonly (WordPart & { readonly start: number })[] {
  const result: (WordPart & { start: number })[] = [];
  let start = 0;
  for (const part of parts) {
    result.push({ ...part, start });
    start += part.text.length;
  }
  return result;
}

function Words({ parts }: { readonly parts: readonly WordPart[] }) {
  return (
    <div className="wrap-anywhere whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 font-mono text-body-sm text-fg">
      {placed(parts).map(part => {
        const key = `${part.start}:${part.kind}`;
        if (part.kind === "same") return <span key={key}>{part.text}</span>;
        const added = part.kind === "added";
        const Tag = added ? "ins" : "del";
        const MarkIcon = added ? IconPlus : IconMinus;
        return (
          <Tag
            key={key}
            className={
              added
                ? "rounded-sm bg-success-bg text-success-fg no-underline"
                : "rounded-sm bg-danger-bg text-danger-fg line-through"
            }
          >
            <MarkIcon
              size={14}
              stroke={1.75}
              aria-hidden="true"
              className="inline align-text-bottom"
            />
            <span className="sr-only">{added ? "added: " : "removed: "}</span>
            {part.text}
          </Tag>
        );
      })}
    </div>
  );
}

/**
 * One changed field of a revision (plan §4.11): its label, then its values
 * before and after (a scalar, or a text field as two blocks of Markdown
 * source), or for a list the items added, removed and changed, each
 * marked by an icon and its word. A text field short enough is one block
 * marked word by word. With no base, the value alone.
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
  const { diff } = row;
  return (
    <section
      aria-labelledby={headingId}
      className="border-b border-border py-4 last:border-b-0"
    >
      <h3 id={headingId} className="mb-2 text-body font-semibold text-fg">
        {row.label}
      </h3>
      {diff.kind === "scalar" ? (
        <Sides
          first={first}
          before={<Parts parts={diff.before} />}
          after={<Parts parts={diff.after} />}
        />
      ) : diff.kind === "text" && diff.words && !first ? (
        <Words parts={diff.words} />
      ) : diff.kind === "text" ? (
        <Sides
          first={first}
          before={<TextBlock text={diff.before} />}
          after={<TextBlock text={diff.after} />}
        />
      ) : (
        <ul role="list" className="grid gap-2 text-body-sm text-fg">
          {diff.added.map(item => (
            <Item key={itemKey(item)} change={first ? null : "added"}>
              <Parts parts={item.parts} />
            </Item>
          ))}
          {diff.removed.map(item => (
            <Item key={itemKey(item)} change="removed">
              <Parts parts={item.parts} />
            </Item>
          ))}
          {diff.changed.map(({ before, after }) => (
            <Item key={itemKey(after)} change="changed">
              <Parts parts={before.parts} />
              <span aria-hidden="true"> → </span>
              <span className="sr-only">, now </span>
              <Parts parts={after.parts} />
            </Item>
          ))}
        </ul>
      )}
    </section>
  );
}
