import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * Every export of an app module is used by app code, not only by tests
 * (the brief's "no unused exports"). `knip --production` (npm run
 * check:unused) is the primary check; this one reads the sources itself, as
 * a second, independent check of app/: each name
 * a module under app/ exports must be imported by another non-test module
 * (app/, workers/, scripts/ or a root config file). Modules whose exports
 * the framework reads (routes, root, the entries) and the test helpers in
 * app/test are not checked. Components no FE1 page uses yet are used by
 * the styleguide route, which is app code.
 */

const root = process.cwd();

const isTest = (path: string) =>
  /\.test\.tsx?$/.test(path) || path.startsWith(join("app", "test"));

/** Every non-test source file that can use an app module. */
const sourceFiles = [
  ...filesUnder("app"),
  ...filesUnder("workers"),
  ...filesUnder("scripts"),
  "vite.config.ts",
  "tailwind.config.ts",
].filter(
  path => /\.(tsx?|mjs)$/.test(path) && !path.endsWith(".d.ts") && !isTest(path)
);

const FRAMEWORK_MODULES = [
  join("app", "root.tsx"),
  join("app", "entry.server.tsx"),
  join("app", "entry.client.tsx"),
];

const checkedModules = sourceFiles.filter(
  path =>
    path.startsWith("app") &&
    !path.startsWith(join("app", "routes")) &&
    !FRAMEWORK_MODULES.includes(path)
);

/** The names a module exports (functions, constants, types, classes). */
function exportedNames(source: string): string[] {
  return [
    ...source.matchAll(
      /^export (?:async )?(?:const|function|type|interface|class|enum) ([A-Za-z_$][\w$]*)/gm
    ),
  ].map(([, name]) => name as string);
}

/**
 * Whether `source` imports `name`: a named or type import, aliased or not,
 * or a name destructured from a dynamic `await import(...)`.
 */
function importsName(source: string, name: string): boolean {
  return [
    ...source.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s+from|const\s+\{([^}]*)\}\s*=\s*await\s+import\(/g
    ),
  ].some(([, named, destructured]) =>
    (named ?? destructured ?? "")
      .split(",")
      .map(
        part =>
          part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+|\s*:\s*/)[0]
      )
      .includes(name)
  );
}

describe("export scan", () => {
  it("reads exported names", () => {
    expect(
      exportedNames(
        "export function Button() {}\nexport async function load() {}\nexport const TONES = {};\nexport type Tone = 1;\nconst hidden = 2;"
      )
    ).toEqual(["Button", "load", "TONES", "Tone"]);
  });

  it("finds named, type and dynamic imports, aliased or not", () => {
    expect(importsName('import { A, type B } from "./x";', "B")).toBe(true);
    expect(importsName('import type { C as D } from "./x";', "C")).toBe(true);
    expect(importsName('import { AB } from "./x";', "A")).toBe(false);
    expect(
      importsName('const { stubLogin } = await import("./stub");', "stubLogin")
    ).toBe(true);
  });
});

describe("app modules", () => {
  it("have no export that only tests use", () => {
    const sources = new Map(
      sourceFiles.map(path => [path, readFileSync(join(root, path), "utf8")])
    );
    const unused = checkedModules.flatMap(path =>
      exportedNames(sources.get(path) ?? "")
        .filter(
          name =>
            ![...sources].some(
              ([other, source]) => other !== path && importsName(source, name)
            )
        )
        .map(name => `${relative("app", path)}: ${name}`)
    );
    // The scan covers the server, schemas, constants, hooks, contexts and
    // content as well as the components.
    for (const directory of ["components", "server", "schemas", "hooks"]) {
      expect(
        checkedModules.some(path => path.startsWith(join("app", directory)))
      ).toBe(true);
    }
    expect(checkedModules.length).toBeGreaterThan(60);
    expect(unused).toEqual([]);
  });
});
