type SpinnerSize = 16 | 20 | 24;

/**
 * A rotating arc (DESIGN §6.17). Always decorative: whatever contains it
 * says it is busy (`aria-busy`, or a "Loading…" / "Saving…" status). Under
 * reduced motion the arc pulses instead of turning.
 *
 * `tone="inherit"` draws it in the surrounding text colour, for filled
 * buttons where an amber arc would vanish into the fill.
 */
export function Spinner({
  size = 16,
  tone = "accent",
}: {
  size?: SpinnerSize;
  tone?: "accent" | "inherit";
}) {
  const stroke = size === 16 ? 2 : 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      className="shrink-0 fill-none motion-safe:animate-spin"
    >
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        strokeWidth={stroke}
        className={
          tone === "accent" ? "stroke-border" : "stroke-current opacity-30"
        }
      />
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.75} ${circumference}`}
        className={`motion-reduce:animate-pulse-soft ${tone === "accent" ? "stroke-accent" : "stroke-current"}`}
      />
    </svg>
  );
}
