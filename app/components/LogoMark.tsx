import { LOGO_MARK_PATHS } from "./logo-mark-paths";

/**
 * The torch mark (DESIGN §5.9). Always decorative: wherever it stands for
 * the site, the Wordmark's text next to it is the accessible name. The
 * handle takes the text colour; the flame uses the accent tokens, so both
 * themes come from CSS. `className` sets the size, e.g. `h-6 w-6` (24 px).
 * `flicker` makes the flame flicker once when a `group` ancestor is
 * hovered (the header's home link), unless motion is reduced.
 */
export function LogoMark({
  className,
  flicker = false,
}: {
  className: string;
  flicker?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path fill="currentColor" d={LOGO_MARK_PATHS.handle} />
      {LOGO_MARK_PATHS.cresset.map(rect => (
        <rect key={`${rect.x},${rect.y}`} fill="currentColor" {...rect} />
      ))}
      <path
        className={
          flicker
            ? "origin-flame fill-accent transform-box-fill motion-safe:group-hover:animate-flicker"
            : "fill-accent"
        }
        d={LOGO_MARK_PATHS.flame}
      />
      <path className="fill-logo-core" d={LOGO_MARK_PATHS.core} />
    </svg>
  );
}

/**
 * The torch with its flame out (DESIGN §6.15, §6.16): the art for empty and
 * error states. The handle is `fg-subtle` and the flame a 1.5 px
 * `border-strong` outline with no fill; `dashed` breaks the outline, for
 * error pages. Decorative, like the lit mark: 48 px in empty states, 64 px
 * on error pages.
 */
export function UnlitMark({
  size = 48,
  dashed = false,
}: {
  size?: 48 | 64;
  dashed?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 text-fg-subtle ${size === 64 ? "h-16 w-16" : "h-12 w-12"}`}
    >
      <path fill="currentColor" d={LOGO_MARK_PATHS.handle} />
      {LOGO_MARK_PATHS.cresset.map(rect => (
        <rect key={`${rect.x},${rect.y}`} fill="currentColor" {...rect} />
      ))}
      <path
        d={LOGO_MARK_PATHS.flame}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeDasharray={dashed ? "3 2.5" : undefined}
        vectorEffect="non-scaling-stroke"
        className="stroke-border-strong"
      />
    </svg>
  );
}
