import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  createSourceFile,
  getModifiers,
  isClassDeclaration,
  isExportAssignment,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isNamedExports,
  isTypeAliasDeclaration,
  isVariableStatement,
  ScriptTarget,
  SyntaxKind,
  type Statement,
} from "typescript";
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

/**
 * The exports React Router reads from a route module (the root included)
 * and from the server entry. knip makes these modules entries and checks
 * none of their exports, so this is the check: any other export is unused.
 */
const ROUTE_MODULE_EXPORTS = new Set([
  "default",
  "loader",
  "action",
  "clientLoader",
  "clientAction",
  "middleware",
  "clientMiddleware",
  "meta",
  "links",
  "headers",
  "handle",
  "shouldRevalidate",
  "ErrorBoundary",
  "HydrateFallback",
  "Layout",
]);
const SERVER_ENTRY_EXPORTS = new Set([
  "default",
  "handleError",
  "handleDataRequest",
  "streamTimeout",
]);

/** The names one top-level statement exports. */
function statementExports(statement: Statement): string[] {
  if (isExportAssignment(statement)) return ["default"];
  if (isExportDeclaration(statement)) {
    return statement.exportClause && isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.map(element => element.name.text)
      : ["*"];
  }
  const modifiers = (
    getModifiers(statement as Parameters<typeof getModifiers>[0]) ?? []
  ).map(modifier => modifier.kind);
  if (!modifiers.includes(SyntaxKind.ExportKeyword)) return [];
  if (modifiers.includes(SyntaxKind.DefaultKeyword)) return ["default"];
  if (isVariableStatement(statement)) {
    return statement.declarationList.declarations.map(declaration =>
      isIdentifier(declaration.name) ? declaration.name.text : "(pattern)"
    );
  }
  if (
    isFunctionDeclaration(statement) ||
    isClassDeclaration(statement) ||
    isTypeAliasDeclaration(statement) ||
    isInterfaceDeclaration(statement)
  ) {
    return [statement.name?.text ?? "default"];
  }
  return ["(unknown)"];
}

/** Every name `source` exports, `default` and `*` included. */
function moduleExports(source: string): string[] {
  return createSourceFile(
    "module.tsx",
    source,
    ScriptTarget.Latest
  ).statements.flatMap(statementExports);
}

describe("framework modules", () => {
  it("reads every kind of export", () => {
    expect(
      moduleExports(
        [
          "export const meta = 1, strayRouteExport = 2;",
          "export async function loader() {}",
          "export default function Page() {}",
          "export type Shape = 1;",
          "const a = 1; export { a as action, a };",
          'export * from "./x";',
          "function hidden() {}",
        ].join("\n")
      )
    ).toEqual([
      "meta",
      "strayRouteExport",
      "loader",
      "default",
      "Shape",
      "action",
      "a",
      "*",
    ]);
  });

  const routeModules = [
    ...filesUnder(join("app", "routes")).filter(path =>
      /(?<!\.test)\.tsx?$/.test(path)
    ),
    join("app", "root.tsx"),
  ];

  it("route modules and the root export only what React Router reads", () => {
    expect(routeModules.length).toBeGreaterThan(10);
    const stray = routeModules.flatMap(path =>
      moduleExports(readFileSync(join(root, path), "utf8"))
        .filter(name => !ROUTE_MODULE_EXPORTS.has(name))
        .map(name => `${path}: ${name}`)
    );
    expect(stray).toEqual([]);
  });

  it("the server entry exports only what React Router reads", () => {
    const path = join("app", "entry.server.tsx");
    expect(
      moduleExports(readFileSync(join(root, path), "utf8")).filter(
        name => !SERVER_ENTRY_EXPORTS.has(name)
      )
    ).toEqual([]);
  });
});
