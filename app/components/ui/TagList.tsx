import { Link as RemixLink } from "@remix-run/react";
import { ExternalMark, externalKind, type ExternalKind } from "./Link";

type Tag = {
  readonly label: string;
  readonly to: string;
  /** The facet the tag belongs to, shown before it: "Mood:" + "Singalong". */
  readonly prefix?: string;
  /** This is the term page being shown (`aria-current="page"`). */
  readonly current?: boolean;
  /** For an absolute URL: where it goes (default "wiki"). */
  readonly external?: ExternalKind;
};

const SIZES = {
  // Below lg, md chips are 36 px tall; with the 8 px row gap that is a 44 px pitch.
  md: "min-h-9 lg:min-h-8",
  sm: "min-h-7",
} as const;

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium transition-colors";
const REST =
  "border-border bg-surface-sunken text-link hover:border-border-strong hover:bg-accent-subtle hover:text-link-hover";
const CURRENT =
  "border-accent bg-accent-subtle text-accent-text focus-visible:-outline-offset-2";

function Chip({
  tag: { label, to, prefix, current = false, external },
  size,
}: {
  tag: Tag;
  size: keyof typeof SIZES;
}) {
  const className = `${CHIP} ${SIZES[size]} ${current ? CURRENT : REST}`;
  const text = (
    <span>
      {prefix ? (
        <span className="font-normal text-fg-muted">{prefix} </span>
      ) : null}
      {label}
    </span>
  );
  const kind = externalKind(to, external ?? "wiki");
  if (kind) {
    return (
      <a href={to} rel="noopener" className={className}>
        {text}
        <ExternalMark kind={kind} size={14} />
      </a>
    );
  }
  return (
    <RemixLink
      to={to}
      prefetch="intent"
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {text}
    </RemixLink>
  );
}

/**
 * Category and facet chips (DESIGN §6.12): a wrapping list of link chips.
 * External chips point at the original wiki unless told otherwise. With no
 * tags it says so in a caption instead of leaving a gap.
 */
export function TagList({
  tags,
  size = "md",
  emptyText = "No categories yet.",
}: {
  tags: readonly Tag[];
  /** `sm` (28 px) for chips inside the infobox. */
  size?: keyof typeof SIZES;
  emptyText?: string;
}) {
  if (tags.length === 0) {
    return <p className="text-caption text-fg-subtle">{emptyText}</p>;
  }
  return (
    <ul role="list" className="flex flex-wrap items-center gap-2">
      {tags.map(tag => (
        <li key={tag.to} className="flex">
          <Chip tag={tag} size={size} />
        </li>
      ))}
    </ul>
  );
}
