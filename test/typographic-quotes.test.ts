import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createSourceFile,
  forEachChild,
  isJsxText,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
  type Node,
  ScriptKind,
  ScriptTarget,
} from "typescript";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * DESIGN §11.1: copy uses typographic punctuation, the apostrophe ’ and
 * British quotes ‘…’ (“…” inside them), never the straight ' or ". This
 * scans every string and JSX text in app/ (tests, generated files and
 * style tokens aside) and the help pages' Markdown outside code spans.
 */

const root = process.cwd();

// A straight apostrophe inside a word, `&apos;`, or a straight-quoted phrase.
// (CSP keywords such as 'self' are quoted by the CSP grammar itself.)
const STRAIGHT =
  /&apos;|\p{L}'\p{L}|\p{L}s' |(?:^|[\s(—])['"][^'"\n]+['"](?=$|[\s.,;:!?)—])/u;
const CSP_KEYWORD = /'(?:self|none|nonce-|unsafe-|strict-|sha\d)/;

function straightQuotesInSource(path: string): string[] {
  const text = readFileSync(join(root, path), "utf8");
  const source = createSourceFile(
    path,
    text,
    ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ScriptKind.TSX : ScriptKind.TS
  );
  const found: string[] = [];
  const visit = (node: Node) => {
    if (
      isStringLiteral(node) ||
      isNoSubstitutionTemplateLiteral(node) ||
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node) ||
      isJsxText(node)
    ) {
      const raw = isJsxText(node) ? node.getText(source) : node.text;
      if (STRAIGHT.test(raw) && !CSP_KEYWORD.test(raw)) {
        found.push(`${path}: ${raw.trim()}`);
      }
    }
    forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function straightQuotesInMarkdown(path: string): string[] {
  return readFileSync(join(root, path), "utf8")
    .split("\n")
    .filter(line => !line.startsWith(":::") && line !== "---")
    .map(line => line.replaceAll(/`[^`]*`/g, ""))
    .filter(line => STRAIGHT.test(line))
    .map(line => `${path}: ${line}`);
}

describe("typographic quotes in copy", () => {
  it("app strings and JSX text use ’ and ‘…’", () => {
    const sources = filesUnder("app").filter(
      path =>
        /\.tsx?$/.test(path) &&
        !/\.(test|gen)\.tsx?$|\.d\.ts$/.test(path) &&
        !path.startsWith("app/test/") &&
        // Font stacks quote family names: CSS values, not copy.
        !path.startsWith("app/styles/")
    );
    expect(sources.length).toBeGreaterThan(50);
    expect(sources.flatMap(straightQuotesInSource)).toEqual([]);
  });

  it("help pages use ’ and ‘…’ outside code", () => {
    const pages = filesUnder("app/content/help").filter(path =>
      path.endsWith(".md")
    );
    expect(pages.length).toBeGreaterThan(5);
    expect(pages.flatMap(straightQuotesInMarkdown)).toEqual([]);
  });

  it("would catch a straight apostrophe or quote", () => {
    expect(STRAIGHT.test("We couldn't")).toBe(true);
    expect(STRAIGHT.test("Don&apos;t")).toBe(true);
    expect(STRAIGHT.test("the bards' wishes")).toBe(true);
    expect(STRAIGHT.test('use "filk" here')).toBe(true);
    expect(STRAIGHT.test("We couldn’t, said ‘Torch’")).toBe(false);
  });
});
