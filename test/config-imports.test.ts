import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NodeFlags,
  ScriptTarget,
  SyntaxKind,
  createSourceFile,
  forEachChild,
  isConstructorDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isImportDeclaration,
  isModuleDeclaration,
  isParameter,
  isStringLiteral,
  type Node,
  type SourceFile,
} from "typescript";

// Vite's `configLoader: "native"` (planned to be the default) runs the
// config files as Node ES modules: no extensionless imports, no `~/` alias,
// and only erasable TypeScript syntax (Node strips types, nothing more).
// This walks the imports from both config files and fails on each, so the
// warning can't come back when someone adds an import to the graph.

const root = process.cwd();
const CONFIGS = ["vite.config.ts", "vitest.config.ts"];

type Problem = string;

function specifiers(source: SourceFile): string[] {
  const found: string[] = [];
  for (const statement of source.statements) {
    if (
      (isImportDeclaration(statement) || isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      isStringLiteral(statement.moduleSpecifier)
    ) {
      found.push(statement.moduleSpecifier.text);
    }
  }
  return found;
}

function erasableProblems(file: string, source: SourceFile): Problem[] {
  const problems: Problem[] = [];
  function visit(node: Node) {
    if (isEnumDeclaration(node)) {
      problems.push(`${file}: enum ${node.name.text}`);
    } else if (
      isModuleDeclaration(node) &&
      (node.flags & NodeFlags.Namespace) !== 0
    ) {
      problems.push(`${file}: namespace ${node.name.getText(source)}`);
    } else if (
      isParameter(node) &&
      node.modifiers?.some(
        modifier =>
          modifier.kind !== SyntaxKind.Decorator &&
          modifier.kind !== SyntaxKind.OverrideKeyword
      ) === true &&
      isConstructorDeclaration(node.parent)
    ) {
      problems.push(`${file}: parameter property`);
    }
    forEachChild(node, visit);
  }
  visit(source);
  return problems;
}

/** Every file reachable by relative import from the configs, and what is wrong with them. */
function walk(entries: readonly string[]): {
  files: string[];
  problems: Problem[];
} {
  const files: string[] = [];
  const problems: Problem[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || files.includes(file)) continue;
    files.push(file);
    const text = readFileSync(join(root, file), "utf8");
    const source = createSourceFile(file, text, ScriptTarget.ES2022, true);
    problems.push(...erasableProblems(file, source));
    for (const specifier of specifiers(source)) {
      if (specifier.startsWith("~/")) {
        problems.push(`${file}: "${specifier}" uses the ~/ alias`);
      } else if (specifier.startsWith(".")) {
        if (!/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) {
          problems.push(`${file}: "${specifier}" has no file extension`);
          continue;
        }
        const target = relative(root, resolve(root, dirname(file), specifier));
        if (existsSync(join(root, target))) queue.push(target);
        else problems.push(`${file}: "${specifier}" does not exist`);
      }
    }
  }
  return { files, problems };
}

describe("the Vite config import graph", () => {
  const { files, problems } = walk(CONFIGS);

  it("reaches the files the config loader evaluates", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "app/content/markdown/options.ts",
        "app/server/env.server.ts",
        "app/server/security-headers.server.ts",
        "app/content/help/frontmatter.ts",
      ])
    );
  });

  it("works under configLoader: native: explicit extensions, no ~/ alias, erasable syntax only", () => {
    expect(problems).toEqual([]);
  });
});
