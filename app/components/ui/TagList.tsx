import { useId, useState } from "react";
import { Link as RouterLink } from "react-router";
import { formatNumber } from "~/catalogue/format";
import { useHydrated } from "~/hooks/useHydrated";
import { Button } from "./Button";
import { ExternalMark, externalKind } from "./Link";

type Tag = {
  readonly label: string;
  readonly to: string;
  /** The facet the tag belongs to, shown before it: "Mood:" + "Singalong". */
  readonly prefix?: string;
  /** This is the term page being shown (`aria-current="page"`). */
  readonly current?: boolean;
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
  tag: { label, to, prefix, current = false },
  size,
}: {
  readonly tag: Tag;
  readonly size: keyof typeof SIZES;
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
  const kind = externalKind(to);
  if (kind) {
    return (
      <a href={to} rel="noopener" className={className}>
        {text}
        <ExternalMark kind={kind} size={14} />
      </a>
    );
  }
  return (
    <RouterLink
      to={to}
      prefetch="intent"
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {text}
    </RouterLink>
  );
}

/** More chips than this collapse behind "Show all {n}" (DESIGN §6.12). */
const VISIBLE_CHIPS = 12;

/**
 * Category and facet chips (DESIGN §6.12): a wrapping list of link chips.
 * A chip to another site is marked as external. With no
 * tags it says so in a caption instead of leaving a gap.
 *
 * More than 12 chips show the first 12 and a "Show all {n}" disclosure
 * button, which keeps focus while it shows or hides the rest. Without JS
 * (and before hydration) every chip is shown and there is no button.
 */
export function TagList({
  tags,
  size = "md",
  emptyText = "No categories yet.",
}: {
  readonly tags: readonly Tag[];
  /** `sm` (28 px) for chips inside the infobox. */
  readonly size?: keyof typeof SIZES;
  readonly emptyText?: string;
}) {
  const listId = useId();
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) {
    return <p className="text-caption text-fg-subtle">{emptyText}</p>;
  }
  const overflows = hydrated && tags.length > VISIBLE_CHIPS;
  const list = (
    <ul id={listId} role="list" className="flex flex-wrap items-center gap-2">
      {tags.map((tag, index) => (
        <li
          key={tag.to}
          hidden={overflows && !expanded && index >= VISIBLE_CHIPS}
          className="flex"
        >
          <Chip tag={tag} size={size} />
        </li>
      ))}
    </ul>
  );
  if (!overflows) {
    return list;
  }
  return (
    <div className="grid justify-items-start gap-2">
      {list}
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          "Show fewer"
        ) : (
          <>
            Show all {formatNumber(tags.length)}
            {/* Named for what it shows, out of context too (a list of buttons). */}
            <span className="sr-only"> categories</span>
          </>
        )}
      </Button>
    </div>
  );
}
