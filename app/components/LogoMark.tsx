import { LOGO_MARK_PATHS } from "./logo-mark-paths";

/**
 * The torch mark (DESIGN §5.9). Always decorative: wherever it stands for
 * the site, the Wordmark's text next to it is the accessible name. The
 * handle takes the text colour; the flame uses the accent tokens, so both
 * themes come from CSS. `className` sets the size, e.g. `h-6 w-6` (24 px).
 */
export function LogoMark({ className }: { className: string }) {
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
      <path className="fill-accent" d={LOGO_MARK_PATHS.flame} />
      <path className="fill-logo-core" d={LOGO_MARK_PATHS.core} />
    </svg>
  );
}
