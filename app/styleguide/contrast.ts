import {
  contrastRatio,
  resolveColour,
  type ColourName,
  type Theme,
} from "~/styles/tokens";

/**
 * The contrast of two tokens in one theme, the way DESIGN §2.7 prints it
 * ("14.11:1"); the swatches show each colour against the canvas.
 */
export function contrastLabel(
  theme: Theme,
  foreground: ColourName,
  background: ColourName
): string {
  const ratio = contrastRatio(
    resolveColour(theme, foreground),
    resolveColour(theme, background)
  );
  return `${ratio.toFixed(2)}:1`;
}
