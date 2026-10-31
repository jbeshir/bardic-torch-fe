import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTokenFiles } from "../scripts/build-tokens.mjs";

/**
 * DESIGN §2.1: colours come only from tokens. The one hand-written file
 * allowed to hold colour literals is app/styles/tokens.ts; the generated
 * files are allowed too, but only while they are byte-for-byte what
 * scripts/build-tokens.mjs writes, so the allowance can't be abused.
 */

const root = process.cwd();
const TOKEN_SOURCE = "app/styles/tokens.ts";
const SCANNED_DIRECTORIES = ["app", "public", "e2e"];
const SCANNED_FILES = [
  "tailwind.config.ts",
  "vite.config.ts",
  "postcss.config.js",
  "playwright.config.ts",
  "tsconfig.json",
  ".eslintrc.cjs",
  ".prettierrc",
];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".svg",
  ".json",
  ".webmanifest",
  ".md",
  ".html",
  "",
]);
const SKIPPED_DIRECTORIES = new Set(["e2e/screenshots"]);

// The CSS named colours (CSS Color 4), lower-case.
const NAMED_COLOURS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black " +
    "blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse " +
    "chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
    "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
    "darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite " +
    "forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
    "greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender " +
    "lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink " +
    "lightsalmon lightseagreen lightskyblue lightslategray lightslategrey " +
    "lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive " +
    "olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
    "palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey " +
    "snow springgreen steelblue tan teal thistle tomato turquoise violet " +
    "wheat white whitesmoke yellow yellowgreen"
  ).split(" ")
);

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow";
const COLOUR_PROPERTY =
  "color|background|background-color|border(?:-[a-z]+)?-color|border|outline|outline-color|fill|stroke|stop-color|flood-color|lighting-color|caret-color|text-decoration-color|column-rule-color|box-shadow|text-shadow";

type Finding = { readonly kind: string; readonly match: string };

const PATTERNS: readonly { readonly kind: string; readonly pattern: RegExp }[] =
  [
    {
      kind: "hex colour",
      pattern:
        /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi,
    },
    {
      kind: "colour function",
      pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()/gi,
    },
    {
      kind: "Tailwind palette class",
      pattern: new RegExp(
        `(?<![\\w-])-?(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?![\\w-])`,
        "g"
      ),
    },
    {
      kind: "Tailwind arbitrary value",
      pattern: /(?<![\w-])-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s]+\]/g,
    },
    {
      kind: "dark: variant",
      pattern: /(?<![\w-])(?:[a-z-]+:)*dark:[a-z-]/g,
    },
    {
      kind: "named colour attribute",
      pattern: new RegExp(
        `\\b(?:fill|stroke|color|stop-color|flood-color)=["'](?:${[...NAMED_COLOURS].join("|")})["']`,
        "gi"
      ),
    },
    {
      kind: "named colour style property",
      pattern: new RegExp(
        `\\b(?:color|background|backgroundColor|borderColor|outlineColor|fill|stroke)\\s*:\\s*["'](?:${[...NAMED_COLOURS].join("|")})["']`,
        "gi"
      ),
    },
  ];

const CSS_DECLARATION = new RegExp(
  `(?<![\\w-])(${COLOUR_PROPERTY})\\s*:\\s*([^;{}]+)`,
  "gi"
);

/** Every raw colour in `source`; `css` also checks declaration values. */
function rawColours(source: string, css: boolean): Finding[] {
  const findings = PATTERNS.flatMap(({ kind, pattern }) =>
    [...source.matchAll(pattern)].map(([match]) => ({ kind, match }))
  );
  if (css) {
    for (const [declaration, , value = ""] of source.matchAll(
      CSS_DECLARATION
    )) {
      const words = value.toLowerCase().split(/[^a-z]+/);
      if (words.some(word => NAMED_COLOURS.has(word))) {
        findings.push({ kind: "named colour in CSS", match: declaration });
      }
    }
  }
  return findings;
}

function filesUnder(directory: string): string[] {
  if (SKIPPED_DIRECTORIES.has(directory)) return [];
  return readdirSync(join(root, directory)).flatMap(name => {
    const path = join(directory, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

const generated = await renderTokenFiles();
const generatedPaths = new Set(generated.map(({ path }) => path));

describe("raw colour detection", () => {
  it.each([
    ["hex colour", 'fill="#FFAA00"'],
    ["hex colour", "color: #fff;"],
    ["colour function", "box-shadow: 0 0 0 rgb(0 0 0 / 0.5)"],
    ["colour function", "hsl(20, 50%, 50%)"],
    ["Tailwind palette class", 'className="bg-stone-100 p-2"'],
    ["Tailwind palette class", 'className="hover:text-white"'],
    ["Tailwind palette class", "`border-red-600`"],
    ["Tailwind arbitrary value", 'className="bg-[#fff]"'],
    ["Tailwind arbitrary value", 'className="w-[min(32rem,100vw)]"'],
    ["dark: variant", 'className="dark:bg-canvas"'],
    ["dark: variant", 'className="md:dark:shadow-none"'],
    ["named colour attribute", '<path fill="red" />'],
    ["named colour style property", "{ color: 'white' }"],
  ])("finds a %s in %s", (kind, source) => {
    expect(rawColours(source, false).map(finding => finding.kind)).toContain(
      kind
    );
  });

  it("finds named colours in CSS declarations", () => {
    expect(rawColours("a { border: 1px solid black; }", true)).toEqual([
      { kind: "named colour in CSS", match: "border: 1px solid black" },
    ]);
  });

  it.each([
    'className="bg-surface text-fg-muted border-border-strong"',
    'className="bg-accent/10 outline-focus fill-logo-core"',
    "color: rgb(var(--fg));",
    "background: rgb(var(--surface-raised) / 0.5);",
    'href="#content"',
    "&#123;",
    "@media (prefers-color-scheme: dark) { }",
    "{ light: theme, dark: theme }",
    "border: 1px solid ButtonText; outline: 2px solid Highlight;",
    "fill: currentColor; background: transparent;",
    'font-family: "Noto Serif", serif;',
  ])("allows %s", source => {
    expect(rawColours(source, true)).toEqual([]);
  });
});

describe("no raw colours outside the token source", () => {
  const files = [
    ...SCANNED_DIRECTORIES.flatMap(filesUnder),
    ...SCANNED_FILES,
  ].filter(path => TEXT_EXTENSIONS.has(extname(path)));

  it("scans the app, public assets, e2e specs and config", () => {
    expect(files).toContain("app/root.tsx");
    expect(files).toContain("public/_headers");
    expect(files).toContain("e2e/support/journey.ts");
  });

  it("finds colours only in tokens.ts and the generated token files", () => {
    const offenders = files
      .filter(path => path !== TOKEN_SOURCE && !generatedPaths.has(path))
      .flatMap(path =>
        rawColours(
          readFileSync(join(root, path), "utf8"),
          extname(path) === ".css"
        ).map(({ kind, match }) => `${path}: ${kind}: ${match}`)
      );
    expect(offenders).toEqual([]);
  });

  it("the token source really is where the colours are", () => {
    const source = readFileSync(join(root, TOKEN_SOURCE), "utf8");
    expect(rawColours(source, false).length).toBeGreaterThan(100);
  });

  it.each(generated.map(({ path, content }) => [path, content]))(
    "%s is exactly the generator's output, with its @generated header",
    (path, content) => {
      const current = readFileSync(join(root, path), "utf8");
      expect(current.split("\n").slice(0, 3).join("\n")).toContain(
        "@generated by scripts/build-tokens.mjs"
      );
      expect(current).toBe(content);
    }
  );
});
