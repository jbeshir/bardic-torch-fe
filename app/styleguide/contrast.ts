import {
  channelString,
  resolveColour,
  type ColourName,
  type Theme,
} from "~/styles/tokens";

/** WCAG 2.x relative luminance of a token in one theme. */
function luminance(theme: Theme, name: ColourName): number {
  const [r = 0, g = 0, b = 0] = channelString(resolveColour(theme, name))
    .split(" ")
    .map(value => {
      const c = Number(value) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The contrast of two tokens in one theme, the way DESIGN §2.7 prints it
 * ("14.11:1"); the swatches show each colour against the canvas.
 */
export function contrastRatio(
  theme: Theme,
  foreground: ColourName,
  background: ColourName
): string {
  const [high, low] = [
    luminance(theme, foreground),
    luminance(theme, background),
  ].sort((a, b) => b - a);
  return `${(((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)).toFixed(2)}:1`;
}
