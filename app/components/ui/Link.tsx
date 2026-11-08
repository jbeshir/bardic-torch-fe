import { Link as RouterLink } from "react-router";
import { IconArrowUpRight, IconExternalLink } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { isWikiUrl } from "~/constants/navigation";

/** Where an external link goes; decides its icon and hidden suffix. */
type ExternalKind = "web" | "wiki";

/** Each kind's icon and the hidden text that says where the link goes. */
export const EXTERNAL_MARKS = {
  web: { icon: IconExternalLink, suffix: " (external link)" },
  wiki: { icon: IconArrowUpRight, suffix: " (opens original wiki)" },
} as const;

/**
 * Where `to` goes: null for an internal path, "wiki" for the original
 * wiki, "web" for any other absolute URL. Every link-like component
 * decides with this, so a link's marks always match its target.
 */
export function externalKind(to: string): ExternalKind | null {
  if (!/^https?:\/\//.test(to)) return null;
  return isWikiUrl(to) ? "wiki" : "web";
}

/**
 * The marks every external link carries (DESIGN §6.3): a decorative icon and
 * a hidden suffix that tells screen-reader users where it goes (§11.4).
 */
export function ExternalMark({
  kind,
  size = "0.85em",
}: {
  readonly kind: ExternalKind;
  readonly size?: number | string;
}) {
  const { icon: MarkIcon, suffix } = EXTERNAL_MARKS[kind];
  return (
    <>
      <MarkIcon
        size={size}
        stroke={1.75}
        aria-hidden="true"
        className="ml-0.5 inline-block shrink-0 align-baseline text-fg-subtle"
      />
      <span className="sr-only">{suffix}</span>
    </>
  );
}

type Appearance = "prose" | "standalone" | "plain" | "muted" | "inherit";

const APPEARANCES: Readonly<Record<Appearance, string>> = {
  prose:
    "text-link underline decoration-link-40 decoration-1 underline-offset-prose visited:text-link-visited visited:decoration-link-visited-40 hover:text-link-hover hover:decoration-link-hover hover:decoration-2 active:text-link-hover",
  standalone:
    "font-medium text-link no-underline underline-offset-prose hover:text-link-hover hover:underline hover:decoration-2 focus-visible:underline active:text-link-hover",
  // Standalone at the surrounding weight: breadcrumbs, the contents list.
  plain:
    "text-link no-underline underline-offset-prose hover:text-link-hover hover:underline focus-visible:underline active:text-link-hover",
  muted:
    "text-fg-muted underline decoration-fg-subtle-50 underline-offset-prose hover:text-link-hover hover:decoration-2 active:text-link-hover",
  // Links inside alerts take the alert's own text colour (DESIGN §6.14).
  inherit:
    "text-inherit underline underline-offset-prose hover:decoration-2 active:decoration-2",
};

const CURRENT = "font-semibold text-fg no-underline";

/** A link's look (DESIGN §6.3), for an anchor that can't be a `Link`. */
export function linkClasses(appearance: Appearance): string {
  return `rounded-sm ${APPEARANCES[appearance]}`;
}

/** A 24 px tall target (WCAG 2.5.8) for links set apart from running text. */
const COMPACT = "inline-flex min-h-6 items-center";

/**
 * Keeps an external link's icon on the same line as its last word, so the
 * mark never wraps onto a line of its own.
 */
function withMark(children: ReactNode, mark: ReactNode) {
  if (typeof children !== "string") {
    return (
      <>
        {children}
        <span className="whitespace-nowrap">{mark}</span>
      </>
    );
  }
  const split = children.lastIndexOf(" ") + 1;
  return (
    <>
      {children.slice(0, split)}
      <span className="whitespace-nowrap">
        {children.slice(split)}
        {mark}
      </span>
    </>
  );
}

/**
 * Where a link goes. A URL that came from the API (a reader added it) is
 * `userContent`: an absolute URL only, which search engines are told not
 * to follow or credit to us (`rel="nofollow ugc"`, DESIGN §6.3).
 */
type Target =
  | {
      /** An internal path, or an absolute URL. */
      readonly to: string;
      readonly userContent?: false;
    }
  | {
      readonly to: `http${string}`;
      readonly userContent: true;
    };

/**
 * A text link (DESIGN §6.3). Internal paths go through React Router with intent
 * prefetch; absolute URLs are plain anchors marked as external, in the same
 * tab. There is no disabled link: render plain text instead.
 */
export function Link({
  to,
  userContent = false,
  children,
  appearance = "standalone",
  current = false,
  compact = false,
}: Target & {
  readonly children: ReactNode;
  readonly appearance?: Appearance;
  /** This link is the page being shown (`aria-current="page"`). */
  readonly current?: boolean;
  /** Outside running text (a footer list, a trail): a 24 px tall target. */
  readonly compact?: boolean;
}) {
  const className = `${current ? `rounded-sm ${CURRENT}` : linkClasses(appearance)}${compact ? ` ${COMPACT}` : ""}`;
  // A user's URL is never routed, even one the pattern doesn't call absolute.
  const kind = externalKind(to) ?? (userContent ? "web" : null);
  if (kind) {
    const content = withMark(children, <ExternalMark kind={kind} />);
    return (
      <a
        href={to}
        rel={userContent ? "nofollow ugc noopener" : "noopener"}
        className={className}
      >
        {/* One flex item, so the words keep their spaces. */}
        {compact ? <span>{content}</span> : content}
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
      {children}
    </RouterLink>
  );
}
