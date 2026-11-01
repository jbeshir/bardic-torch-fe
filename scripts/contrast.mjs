// `npm run check:contrast` (in validate): every pair in the contrast table of
// docs/DESIGN.md §2.7 is recomputed from app/styles/tokens.ts. A pair fails if
// either theme is below its minimum, or if the ratio printed in the table no
// longer matches the tokens, so the table can't go stale. It also checks that
// the primary (accent) and destructive (danger) fills are at least 30° of hue
// apart in both themes (DESIGN §2.4). Run through tsx.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  channels,
  COLOURS,
  contrastRatio,
  resolveColour,
} from "../app/styles/tokens.ts";

const DESIGN_DOC = new URL("../docs/DESIGN.md", import.meta.url);
const THEMES = ["light", "dark"];
const MIN_HUE_GAP = 30;
const HUE_PAIRS = [
  ["accent", "danger"],
  ["accent-hover", "danger-hover"],
];

function hue(hex) {
  const [r, g, b] = channels(hex).map(value => value / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

/** The smaller angle between the hues of two colours, in degrees. */
export function hueDistance(first, second) {
  const gap = Math.abs(hue(first) - hue(second));
  return Math.min(gap, 360 - gap);
}

const ROW =
  /^\|\s*`([a-z0-9-]+)` on `([a-z0-9-]+)`\s*\|\s*([\d.]+):1\s*\|\s*([\d.]+):1\s*\|\s*([\d.]+):1\s*\|/;

/** The contrast pairs of a design document's table, as printed. */
export function parseContrastTable(markdown) {
  return markdown.split("\n").flatMap(line => {
    const match = ROW.exec(line);
    if (!match) return [];
    const [, foreground, background, minimum, light, dark] = match;
    return [
      {
        foreground,
        background,
        minimum: Number(minimum),
        printed: { light, dark },
      },
    ];
  });
}

/** @type {(theme: string, name: string) => string | undefined} */
function tokenColour(theme, name) {
  return name in COLOURS[theme] ? resolveColour(theme, name) : undefined;
}

/**
 * Problems with the given pairs and the hue gap; empty when all is well.
 * `resolve(theme, name)` gives a token's colour, or undefined if unknown.
 * @param {ReturnType<typeof parseContrastTable>} pairs
 * @param {(theme: string, name: string) => string | undefined} [resolve]
 * @returns {string[]}
 */
export function contrastProblems(pairs, resolve = tokenColour) {
  const problems = [];
  if (pairs.length === 0) problems.push("no contrast pairs found in the table");
  for (const { foreground, background, minimum, printed } of pairs) {
    const label = `${foreground} on ${background}`;
    for (const theme of THEMES) {
      const fg = resolve(theme, foreground);
      const bg = resolve(theme, background);
      if (!fg || !bg) {
        problems.push(`${label}: unknown token`);
        break;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio < minimum) {
        problems.push(
          `${label} (${theme}): ${ratio.toFixed(2)}:1 is below ${minimum}:1`
        );
      }
      if (ratio.toFixed(2) !== printed[theme]) {
        problems.push(
          `${label} (${theme}): the table says ${printed[theme]}:1, the tokens give ${ratio.toFixed(2)}:1`
        );
      }
    }
  }
  for (const theme of THEMES) {
    for (const [first, second] of HUE_PAIRS) {
      const gap = hueDistance(resolve(theme, first), resolve(theme, second));
      if (gap < MIN_HUE_GAP) {
        problems.push(
          `${first} and ${second} (${theme}) are ${gap.toFixed(1)}° of hue apart; they must differ by at least ${MIN_HUE_GAP}°`
        );
      }
    }
  }
  return problems;
}

async function main() {
  const pairs = parseContrastTable(await readFile(DESIGN_DOC, "utf8"));
  const problems = contrastProblems(pairs);
  if (problems.length > 0) {
    console.error(`check:contrast failed:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(
    `check:contrast: ${pairs.length} pairs pass in both themes; accent and danger are at least ${MIN_HUE_GAP}° of hue apart`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
