import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastProblems,
  contrastRatio,
  hueDistance,
  parseContrastTable,
} from "./contrast.mjs";

const TABLE = `
| Pair | Min | Light | Dark | Notes |
|---|---|---|---|---|
| \`fg\` on \`canvas\`   | 4.5:1 | 21.00:1 | 1.00:1 | body |
| \`focus\` on \`canvas\` | 3:1 | 2.50:1 | 3.00:1 |  |
Some prose with \`fg\` on \`canvas\` that isn't a row.
`;

const COLOURS: Record<string, Record<string, string>> = {
  light: {
    fg: "#000000",
    canvas: "#FFFFFF",
    focus: "#959595",
    accent: "#FF0000",
    danger: "#FF0000",
    "accent-hover": "#FF8000",
    "danger-hover": "#0000FF",
  },
  dark: {
    fg: "#FFFFFF",
    canvas: "#FFFFFF",
    focus: "#FFFFFF",
    accent: "#FF8000",
    danger: "#FF00FF",
    "accent-hover": "#FF8000",
    "danger-hover": "#0000FF",
  },
};
const resolve = (theme: string, name: string) => COLOURS[theme]?.[name];

describe("contrast check", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("measures hue distance the short way round the wheel", () => {
    expect(hueDistance("#FF0000", "#FF8000")).toBeCloseTo(30, 0);
    expect(hueDistance("#FF0040", "#FF4000")).toBeCloseTo(30, 0);
    expect(hueDistance("#FF0000", "#00FFFF")).toBeCloseTo(180, 5);
  });

  it("reads only the table rows", () => {
    expect(parseContrastTable(TABLE)).toEqual([
      {
        foreground: "fg",
        background: "canvas",
        minimum: 4.5,
        printed: { light: "21.00", dark: "1.00" },
      },
      {
        foreground: "focus",
        background: "canvas",
        minimum: 3,
        printed: { light: "2.50", dark: "3.00" },
      },
    ]);
  });

  it("reports pairs below their minimum, stale printed ratios and a small hue gap", () => {
    const problems = contrastProblems(parseContrastTable(TABLE), resolve);
    expect(problems).toEqual(
      expect.arrayContaining([
        "fg on canvas (dark): 1.00:1 is below 4.5:1",
        expect.stringMatching(
          /^focus on canvas \(light\): the table says 2\.50:1, the tokens give \d/
        ),
        expect.stringMatching(
          /^accent and danger \(light\) are 0\.0° of hue apart/
        ),
      ])
    );
    expect(
      problems.some(problem => problem.startsWith("accent and danger (dark)"))
    ).toBe(false);
  });

  it("reports unknown tokens and an empty table", () => {
    expect(contrastProblems([], resolve)).toContain(
      "no contrast pairs found in the table"
    );
    expect(
      contrastProblems(
        [
          {
            foreground: "nope",
            background: "canvas",
            minimum: 3,
            printed: { light: "1.00", dark: "1.00" },
          },
        ],
        resolve
      )
    ).toContain("nope on canvas: unknown token");
  });

  it("passes for the design document and the real tokens", () => {
    const design = readFileSync(
      new URL("../docs/DESIGN.md", import.meta.url),
      "utf8"
    );
    const pairs = parseContrastTable(design);
    expect(pairs.length).toBeGreaterThanOrEqual(100);
    expect(contrastProblems(pairs)).toEqual([]);
  });
});
