import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * Data is immutable (CLAUDE.md rule 4), and props are no exception: every
 * member of a destructured first parameter's type literal (a component's
 * props, a hook's options) and of a `…Props` type is `readonly`.
 */
function mutableMembers(path: string, text: string): string[] {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const literals: ts.TypeLiteralNode[] = [];
  const collect = (type: ts.TypeNode | undefined): void => {
    if (!type) return;
    if (ts.isTypeLiteralNode(type)) literals.push(type);
    else if (ts.isIntersectionTypeNode(type) || ts.isUnionTypeNode(type)) {
      type.types.forEach(collect);
    }
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)) &&
      node.parameters[0] &&
      ts.isObjectBindingPattern(node.parameters[0].name)
    ) {
      collect(node.parameters[0].type);
    }
    if (ts.isTypeAliasDeclaration(node) && /Props$/.test(node.name.text)) {
      collect(node.type);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return literals.flatMap(literal =>
    literal.members
      .filter(
        member =>
          ts.isPropertySignature(member) &&
          !member.modifiers?.some(
            modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
          )
      )
      .map(member => `${path}: ${member.name?.getText(source)}`)
  );
}

describe("readonly props", () => {
  it("every component's props and hook's options are readonly", () => {
    const sources = filesUnder("app").filter(
      path => /\.tsx?$/.test(path) && !/\.(test|gen)\.tsx?$|\.d\.ts$/.test(path)
    );
    expect(sources.length).toBeGreaterThan(50);
    expect(
      sources.flatMap(path => mutableMembers(path, readFileSync(path, "utf8")))
    ).toEqual([]);
  });

  it("finds a mutable prop", () => {
    expect(
      mutableMembers(
        "x.tsx",
        "function A({ a, b }: { readonly a: string; b: number }) {}"
      )
    ).toEqual(["x.tsx: b"]);
    expect(mutableMembers("x.ts", "type ButtonProps = { a: string };")).toEqual(
      ["x.ts: a"]
    );
  });
});
