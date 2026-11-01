import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { compileMarkdown } from "~/test/markdown";

/**
 * Plan §0.10 chose plain Markdown so Prettier can format help pages safely.
 * These check that it does: every page is already formatted, and however
 * Prettier wraps a page, it compiles to the same page.
 */

const DIRECTORY = join(process.cwd(), "app", "content", "help");
const FILES = readdirSync(DIRECTORY).filter(name => name.endsWith(".md"));

async function rendered(source: string): Promise<string> {
  const { page, frontmatter, contents } = await compileMarkdown(source);
  const html = renderToStaticMarkup(createElement(page));
  return JSON.stringify({
    frontmatter,
    contents,
    html: html.replace(/\s+/g, " "),
  });
}

describe("help pages and Prettier", () => {
  it("finds the help pages", () => {
    expect(FILES).toContain("index.md");
  });

  it.each(FILES)("%s is already formatted", async name => {
    const path = join(DIRECTORY, name);
    const source = readFileSync(path, "utf8");
    const options = { ...(await resolveConfig(path)), filepath: path };
    expect(await format(source, options)).toBe(source);
  });

  it.each(FILES)(
    "%s compiles to the same page however Prettier wraps it",
    async name => {
      const path = join(DIRECTORY, name);
      const source = readFileSync(path, "utf8");
      const rewrapped = await format(source, {
        filepath: path,
        proseWrap: "always",
        printWidth: 40,
      });
      expect(rewrapped).not.toBe(source);
      expect(await rendered(rewrapped)).toBe(await rendered(source));
    }
  );
});
