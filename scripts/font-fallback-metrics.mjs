// Computes the metric overrides for the Fraunces fallback faces in
// app/styles/fonts.css, with fontaine's formula: the fallback is scaled so
// its average character width matches Fraunces, and the vertical metrics are
// Fraunces' own, divided by that scale. Run it once per Fraunces version
// (`node scripts/font-fallback-metrics.mjs`) and copy the printed values into
// fonts.css; the values are committed, so builds never run it.
import georgia from "@capsizecss/metrics/georgia";
import notoSerif from "@capsizecss/metrics/notoSerif";
import { fromFile } from "@capsizecss/unpack/fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const frauncesFile =
  require.resolve("@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2");

const percent = value => `${(value * 100).toFixed(2)}%`;

function overrides(font, fallback) {
  const sizeAdjust =
    font.xWidthAvg /
    font.unitsPerEm /
    (fallback.xWidthAvg / fallback.unitsPerEm);
  return {
    "size-adjust": percent(sizeAdjust),
    "ascent-override": percent(font.ascent / font.unitsPerEm / sizeAdjust),
    "descent-override": percent(
      Math.abs(font.descent) / font.unitsPerEm / sizeAdjust
    ),
    "line-gap-override": percent(font.lineGap / font.unitsPerEm / sizeAdjust),
  };
}

const fraunces = await fromFile(frauncesFile);
for (const fallback of [georgia, notoSerif]) {
  console.log(`/* Fraunces fallback: ${fallback.familyName} */`);
  for (const [property, value] of Object.entries(
    overrides(fraunces, fallback)
  )) {
    console.log(`${property}: ${value};`);
  }
}
