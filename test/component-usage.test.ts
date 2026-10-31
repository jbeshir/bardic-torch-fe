import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every export of the component library is used by app code, not only by
 * tests (the brief's "no unused exports"). ESLint's no-unused-modules counts
 * test imports as uses, so this check reads the sources itself: each name a
 * component module exports must be imported by another non-test module
 * under app/. Components that no FE1 page uses yet are used by the
 * styleguide route, which is app code.
 */

const root = process.cwd();

function filesUnder(directory: string): string[] {
  return readdirSync(join(root, directory)).flatMap(name => {
    const path = join(directory, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

const appModules = filesUnder("app").filter(
  path => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
);
const componentModules = appModules.filter(path =>
  path.startsWith(join("app", "components"))
);

/** The names a module exports (functions, constants, types). */
function exportedNames(source: string): string[] {
  return [
    ...source.matchAll(
      /^export (?:const|function|type|interface|class) ([A-Za-z_$][\w$]*)/gm
    ),
  ].map(([, name]) => name as string);
}

/** Whether `source` imports `name` from somewhere. */
function importsName(source: string, name: string): boolean {
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from/g)].some(
    ([, names]) =>
      (names ?? "")
        .split(",")
        .map(
          part =>
            part
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0]
        )
        .includes(name)
  );
}

describe("component export scan", () => {
  it("reads exported names", () => {
    expect(
      exportedNames(
        "export function Button() {}\nexport const TONES = {};\nexport type Tone = 1;\nconst hidden = 2;"
      )
    ).toEqual(["Button", "TONES", "Tone"]);
  });

  it("finds named and type imports, aliased or not", () => {
    expect(importsName('import { A, type B } from "./x";', "B")).toBe(true);
    expect(importsName('import type { C as D } from "./x";', "C")).toBe(true);
    expect(importsName('import { AB } from "./x";', "A")).toBe(false);
  });
});

describe("component library", () => {
  it("has no export that only tests use", () => {
    const sources = new Map(
      appModules.map(path => [path, readFileSync(join(root, path), "utf8")])
    );
    const unused = componentModules.flatMap(path =>
      exportedNames(sources.get(path) ?? "")
        .filter(
          name =>
            ![...sources].some(
              ([other, source]) => other !== path && importsName(source, name)
            )
        )
        .map(name => `${relative("app", path)}: ${name}`)
    );
    expect(componentModules.length).toBeGreaterThan(20);
    expect(unused).toEqual([]);
  });
});
