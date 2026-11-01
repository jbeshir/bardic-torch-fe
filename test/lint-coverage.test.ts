import { ESLint } from "eslint";
import { extname } from "node:path";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * ESLint 8 lints a file only if its extension is passed with --ext (`.js`
 * by default) or an override's `files` matches it. So every code file in
 * the repository, scripts and config files included, must get the import
 * rules, `import/no-unused-modules` among them, from .eslintrc.cjs.
 */
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const ROOT_FILES = [
  ".eslintrc.cjs",
  "postcss.config.js",
  "tailwind.config.ts",
  "vite.config.ts",
  "playwright.config.ts",
  "load-context.ts",
  "worker-configuration.d.ts",
];

const codeFiles = [
  ...["app", "functions", "test", "scripts", "e2e"].flatMap(filesUnder),
  ...ROOT_FILES,
].filter(path => CODE_EXTENSIONS.has(extname(path)));

describe("lint coverage", () => {
  it("scans scripts, config files and app code", () => {
    expect(codeFiles).toEqual(
      expect.arrayContaining([
        "scripts/build-pages.mjs",
        ".eslintrc.cjs",
        "postcss.config.js",
        "app/root.tsx",
      ])
    );
  });

  it("applies import/no-unused-modules to every code file", async () => {
    const eslint = new ESLint();
    const uncovered: string[] = [];
    for (const path of codeFiles) {
      const config = (await eslint.calculateConfigForFile(path)) as {
        readonly rules?: Readonly<Record<string, readonly unknown[]>>;
      };
      const rule = config.rules?.["import/no-unused-modules"];
      if ((await eslint.isPathIgnored(path)) || rule?.[0] !== "error") {
        uncovered.push(path);
      }
    }
    expect(uncovered).toEqual([]);
  }, 60_000);
});
