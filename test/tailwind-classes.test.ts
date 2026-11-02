import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import {
  createSourceFile,
  forEachChild,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
  ScriptKind,
  ScriptTarget,
  type Node,
} from "typescript";
import { describe, expect, it } from "vitest";
import {
  componentClasses,
  RESTRICTED_CLASSES,
} from "../scripts/tailwind-classes.mjs";
import { UTILITY_CLASSES } from "../scripts/tailwind-theme.mjs";
import { filesUnder } from "./support/files";

/**
 * Every class the app writes is one the build makes (F16). Lint
 * (better-tailwindcss/no-unknown-classes) checks the class attributes; this
 * compiles app/styles/app.css with Tailwind itself, over what Tailwind's
 * scanner finds in app/**, the way the Vite build does, and checks every
 * class string in the app's modules against it, constants included.
 */

const root = process.cwd();
const APP_CSS = join(root, "app/styles/app.css");

const compiler = await compile(readFileSync(APP_CSS, "utf8"), {
  base: dirname(APP_CSS),
  onDependency: () => undefined,
});
const scanner = new Scanner({
  sources: compiler.sources.map(source => ({ ...source, negated: false })),
});
const candidates = scanner.scan();
const css = compiler.build(candidates);

/** The classes `stylesheet` has a rule for, unescaped. */
function classesIn(stylesheet: string): Set<string> {
  return new Set(
    [...stylesheet.matchAll(/\.(-?(?:\\.|[a-z_])(?:\\.|[\w-])*)/gi)].map(
      ([, name = ""]) => name.replace(/\\(.)/g, "$1")
    )
  );
}

const built = classesIn(css);
const components = new Set(componentClasses());
const isClass = (token: string) => built.has(token) || components.has(token);

/** A word that may be a class: lower case, no sentence punctuation. */
const CLASS_SHAPE = /^!?-?[a-z0-9@][\w:/.%!-]*$/;

type ClassString = {
  readonly file: string;
  readonly text: string;
  /** An expression is glued to its start or its end (no space between). */
  readonly gluedStart: boolean;
  readonly gluedEnd: boolean;
};

/** String literals and template parts in `file` that read as class lists. */
function classStrings(file: string): ClassString[] {
  const source = createSourceFile(
    file,
    readFileSync(join(root, file), "utf8"),
    ScriptTarget.Latest,
    true,
    extname(file) === ".tsx" ? ScriptKind.TSX : ScriptKind.TS
  );
  const found: ClassString[] = [];
  const visit = (node: Node) => {
    if (
      isStringLiteral(node) ||
      isNoSubstitutionTemplateLiteral(node) ||
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node)
    ) {
      const text = node.text;
      const tokens = text.split(/\s+/).filter(Boolean);
      if (
        tokens.length > 0 &&
        tokens.every(token => CLASS_SHAPE.test(token)) &&
        tokens.some(isClass)
      ) {
        found.push({
          file,
          text,
          gluedStart:
            (isTemplateMiddle(node) || isTemplateTail(node)) &&
            /^\S/.test(text),
          gluedEnd:
            (isTemplateHead(node) || isTemplateMiddle(node)) &&
            /\S$/.test(text),
        });
      }
    }
    forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const modules = filesUnder("app").filter(path =>
  /(?<!\.test)\.tsx?$/.test(path)
);
const strings = modules.flatMap(classStrings);
const tokens = [
  ...new Set(strings.flatMap(({ text }) => text.split(/\s+/).filter(Boolean))),
];

/** The rules `classes` compile to, from a compiler of their own. */
async function rulesFor(...classes: string[]): Promise<string> {
  const own = await compile(readFileSync(APP_CSS, "utf8"), {
    base: dirname(APP_CSS),
    onDependency: () => undefined,
  });
  const all = own.build(classes);
  // Only the utilities layer: the theme and preflight come with every build.
  return all.slice(all.indexOf("@layer utilities {"));
}

describe("Tailwind classes in the app", () => {
  it("reads the app's class strings", () => {
    expect(strings.length).toBeGreaterThan(200);
    expect(tokens).toEqual(
      expect.arrayContaining(["md:p-5", "stack-y-3", "bg-shimmer", "prose-bt"])
    );
  });

  it("builds a rule for every class the app writes", () => {
    const unknown = strings.flatMap(({ file, text }) =>
      text
        .split(/\s+/)
        .filter(token => token !== "" && !isClass(token))
        .map(token => `${file}: ${token}`)
    );
    expect(unknown).toEqual([]);
  });

  it("writes no class glued to a template expression, which Tailwind's scanner would miss", () => {
    const glued = strings
      .filter(({ gluedStart, gluedEnd }) => gluedStart || gluedEnd)
      .map(({ file, text }) => `${file}: ${JSON.stringify(text)}`);
    expect(glued).toEqual([]);
  });

  it("writes no restricted class (scripts/tailwind-classes.mjs)", () => {
    const restricted = tokens.filter(token =>
      RESTRICTED_CLASSES.some(({ pattern }) => new RegExp(pattern).test(token))
    );
    expect(restricted).toEqual([]);
  });

  it("builds every named utility the theme generates", () => {
    const missing = UTILITY_CLASSES.filter(name => !built.has(name));
    // Only the ones the app uses are in the build; each of the rest compiles.
    const unbuildable = missing.filter(
      name => !classesIn(compiler.build([name])).has(name)
    );
    expect(unbuildable).toEqual([]);
  });
});

describe("the theme Tailwind builds from", () => {
  it("starts its @theme by clearing every default", () => {
    const tokens = readFileSync(join(root, "app/styles/tokens.css"), "utf8");
    expect(tokens).toMatch(/^@theme \{\n {2}--\*: initial;\n/m);
    expect(tokens.match(/^@theme \{/gm)).toHaveLength(1);
  });

  it.each([
    ["font-semibold", "font-weight: var(--font-weight-semibold)"],
    ["font-medium", "font-weight: var(--font-weight-medium)"],
    ["font-normal", "font-weight: var(--font-weight-normal)"],
    ["max-w-md", "max-width: var(--container-md)"],
    ["leading-tight", "line-height: var(--leading-tight)"],
    ["tracking-wide", "letter-spacing: var(--tracking-wide)"],
  ])(
    "builds %s from the namespace --*: initial cleared (S21)",
    async (name, declaration) => {
      expect(await rulesFor(name)).toContain(declaration);
    }
  );

  it("draws hover styles only for a fine pointer that can hover, as FE1 did", async () => {
    expect(await rulesFor("hover:underline")).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.hover\\:underline:hover \{\s*text-decoration-line: underline;/
    );
  });

  it.each(["button", "input", "select", "optgroup", "textarea"])(
    "leaves the %s element's opacity to the browser, as FE1's preflight did (a disabled select fades)",
    element => {
      // Bare element selectors only: preflight's rules and base.css's.
      const opacities = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(
        ([, selectors = "", body = ""]) =>
          selectors
            .split(",")
            .map(selector => selector.trim())
            .includes(element)
            ? [...body.matchAll(/(?:^|[;\s])opacity: ([^;]+);/g)].map(
                ([, value]) => value
              )
            : []
      );
      // Preflight writes 1 first; base.css reverts it.
      expect(opacities).toEqual(["1", "revert"]);
    }
  );

  it("transitions the colours FE1 did, not the outline colour", async () => {
    const rule = await rulesFor("transition-colors");
    const lists = [...rule.matchAll(/transition-property: ([^;]+);/g)].map(
      ([, list]) => list
    );
    expect(lists.at(-1)).toBe(
      "color, background-color, border-color, text-decoration-color, fill, stroke"
    );
  });
});
