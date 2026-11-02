import { readFileSync } from "node:fs";
import {
  createSourceFile,
  forEachChild,
  isArrowFunction,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isIntersectionTypeNode,
  isObjectBindingPattern,
  isParenthesizedTypeNode,
  isPropertySignature,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  type Node,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  type TypeLiteralNode,
  type TypeNode,
} from "typescript";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * Data is immutable (CLAUDE.md rule 4), and props are no exception: every
 * member of a destructured first parameter's type literal (a component's
 * props, a hook's options) and of a `…Props` type is `readonly`, and so is
 * every member of a type alias in the same file that those types are built
 * from (e.g. `Props = Look & Content`).
 */
function mutableMembers(path: string, text: string): string[] {
  const source = createSourceFile(
    path,
    text,
    ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ScriptKind.TSX : ScriptKind.TS
  );
  const aliases = new Map<string, TypeNode>();
  const index = (node: Node): void => {
    if (isTypeAliasDeclaration(node)) {
      aliases.set(node.name.text, node.type);
    }
    forEachChild(node, index);
  };
  index(source);

  const literals = new Set<TypeLiteralNode>();
  const followed = new Set<string>();
  const collect = (type: TypeNode | undefined): void => {
    if (!type) return;
    if (isTypeLiteralNode(type)) literals.add(type);
    else if (isIntersectionTypeNode(type) || isUnionTypeNode(type)) {
      type.types.forEach(collect);
    } else if (isParenthesizedTypeNode(type)) {
      collect(type.type);
    } else if (
      isTypeReferenceNode(type) &&
      isIdentifier(type.typeName) &&
      !followed.has(type.typeName.text)
    ) {
      followed.add(type.typeName.text);
      collect(aliases.get(type.typeName.text));
    }
  };
  const visit = (node: Node): void => {
    if (
      (isFunctionDeclaration(node) ||
        isArrowFunction(node) ||
        isFunctionExpression(node)) &&
      node.parameters[0] &&
      isObjectBindingPattern(node.parameters[0].name)
    ) {
      collect(node.parameters[0].type);
    }
    if (isTypeAliasDeclaration(node) && /Props$/.test(node.name.text)) {
      collect(node.type);
    }
    forEachChild(node, visit);
  };
  visit(source);
  return [...literals].flatMap(literal =>
    literal.members
      .filter(
        member =>
          isPropertySignature(member) &&
          !member.modifiers?.some(
            modifier => modifier.kind === SyntaxKind.ReadonlyKeyword
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
    expect(
      mutableMembers(
        "x.tsx",
        "type Look = { a: string }; type Content = { readonly b: string } | { c: string }; type Props = Look & (Content); function A({ a }: Props) {}"
      )
    ).toEqual(["x.tsx: a", "x.tsx: c"]);
  });
});
