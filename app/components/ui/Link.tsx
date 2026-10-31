import { Link as RemixLink } from "@remix-run/react";
import { IconArrowUpRight, IconExternalLink } from "@tabler/icons-react";
import type { ReactNode } from "react";

/** Where an external link goes; decides its icon and hidden suffix. */
export type ExternalKind = "web" | "wiki";

const EXTERNAL = {
  web: { icon: IconExternalLink, suffix: " (external link)" },
  wiki: { icon: IconArrowUpRight, suffix: " (opens original wiki)" },
} as const;

/** The external kind of `to`, or null when it is an internal path. */
export function externalKind(
  to: string,
  kind: ExternalKind = "web"
): ExternalKind | null {
  return /^https?:\/\//.test(to) ? kind : null;
}

/**
 * The marks every external link carries (DESIGN §6.3): a decorative icon and
 * a hidden suffix that tells screen-reader users where it goes (§11.4).
 */
export function ExternalMark({
  kind,
  size = "0.85em",
}: {
  kind: ExternalKind;
  size?: number | string;
}) {
  const { icon: MarkIcon, suffix } = EXTERNAL[kind];
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

type Appearance = "prose" | "standalone" | "muted" | "inherit";

const APPEARANCES: Record<Appearance, string> = {
  prose:
    "text-link underline decoration-link/40 decoration-1 underline-offset-prose visited:text-link-visited visited:decoration-link-visited/40 hover:text-link-hover hover:decoration-link-hover hover:decoration-2 active:text-link-hover",
  standalone:
    "font-medium text-link no-underline underline-offset-prose hover:text-link-hover hover:underline hover:decoration-2 focus-visible:underline active:text-link-hover",
  muted:
    "text-fg-muted underline decoration-fg-subtle/50 underline-offset-prose hover:text-link-hover hover:decoration-2 active:text-link-hover",
  // Links inside alerts take the alert's own text colour (DESIGN §6.14).
  inherit:
    "text-inherit underline underline-offset-prose hover:decoration-2 active:decoration-2",
};

const CURRENT = "font-semibold text-fg no-underline";

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
 * A text link (DESIGN §6.3). Internal paths go through Remix with intent
 * prefetch; absolute URLs are plain anchors marked as external, in the same
 * tab. There is no disabled link: render plain text instead.
 */
export function Link({
  to,
  children,
  appearance = "standalone",
  external,
  current = false,
}: {
  /** An internal path, or an absolute URL. */
  to: string;
  children: ReactNode;
  appearance?: Appearance;
  /** For an absolute URL: where it goes (default "web"). */
  external?: ExternalKind;
  /** This link is the page being shown (`aria-current="page"`). */
  current?: boolean;
}) {
  const className = `rounded-sm ${current ? CURRENT : APPEARANCES[appearance]}`;
  const kind = externalKind(to, external);
  if (kind) {
    return (
      <a href={to} rel="noopener" className={className}>
        {withMark(children, <ExternalMark kind={kind} />)}
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
      {children}
    </RemixLink>
  );
}
