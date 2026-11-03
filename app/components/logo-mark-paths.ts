/**
 * Geometry of the torch mark on a 24 × 24 grid (DESIGN §5.9). LogoMark draws
 * it inline and scripts/build-tokens.mjs draws the favicon from it, so the
 * two can't drift apart.
 */
export const LOGO_MARK_PATHS = {
  handle:
    "M10.6 12.5h2.8l-0.75 9.25a0.9 0.9 0 0 1-0.9 0.75h-0.3a0.9 0.9 0 0 1-0.9-0.75z",
  /** The bound head (cresset) and one binding ring on the shaft. */
  cresset: [
    { x: 8.75, y: 10, width: 6.5, height: 2.75, rx: 1.1 },
    { x: 10.1, y: 15.25, width: 3.8, height: 1.1, rx: 0.55 },
  ],
  flame:
    "M12 1.25c2.9 2.6 4.6 4.75 4.6 6.75 0 1.3-0.95 2-2 2H9.4c-1.05 0-2-0.7-2-2 0-1.7 1.1-2.95 2.15-3.75 0.1 1.2 0.65 2.05 1.4 2.4C10.75 4.7 11.15 2.85 12 1.25z",
  core: "M12.2 4.9c1.35 1.35 2.1 2.45 2.1 3.4 0 0.9-0.95 1.45-2.3 1.45s-2.2-0.6-2.2-1.35c0-0.8 0.55-1.4 1.15-1.7 0.2 0.7 0.6 1.1 1.1 1.2-0.3-1-0.25-2 0.15-3z",
} as const;
