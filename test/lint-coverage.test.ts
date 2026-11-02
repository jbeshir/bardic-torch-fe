import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { extname, matchesGlob } from "node:path";
import { parseConfigFileTextToJson } from "typescript";
import { describe, expect, it } from "vitest";
import { filesUnder } from "./support/files";

/**
 * ESLint lints a file only if no ignore pattern and some config's `files`
 * match it. So every code file in the repository, scripts and config files
 * included, must be linted with the import rules (and, for TypeScript, the
 * unused-variable rule) at error from eslint.config.ts. Unused exports,
 * files and dependencies are knip's job (knip.json), so every code file must
 * also be in knip's project.
 */
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const ROOT_FILES = [
  "eslint.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "react-router.config.ts",
  "playwright.config.ts",
  "worker-configuration.d.ts",
];

const codeFiles = [
  ...["app", "workers", "test", "scripts", "e2e"].flatMap(filesUnder),
  ...ROOT_FILES,
].filter(path => CODE_EXTENSIONS.has(extname(path)));

type RuleEntry = readonly [severity: number, ...options: unknown[]];
const ERROR = 2;

describe("lint coverage", () => {
  it("scans scripts, config files and app code", () => {
    expect(codeFiles).toEqual(
      expect.arrayContaining([
        "scripts/build.mjs",
        "workers/app.ts",
        "worker-configuration.d.ts",
        "eslint.config.ts",
        "vite.config.ts",
        "app/root.tsx",
      ])
    );
  });

  it(
    "lints every code file with the import rules at error",
    { timeout: 60_000 },
    async () => {
      const eslint = new ESLint();
      const uncovered: string[] = [];
      for (const path of codeFiles) {
        const config = (await eslint.calculateConfigForFile(path)) as {
          readonly rules?: Readonly<Record<string, RuleEntry>>;
        };
        const severity = (rule: string) => config.rules?.[rule]?.[0];
        const typescript = /\.tsx?$/.test(path);
        if (
          (await eslint.isPathIgnored(path)) ||
          severity("import-x/no-unresolved") !== ERROR ||
          (typescript &&
            severity("@typescript-eslint/no-unused-vars") !== ERROR)
        ) {
          uncovered.push(path);
        }
      }
      expect(uncovered).toEqual([]);
    }
  );

  it("puts every code file in knip's project", () => {
    // knip.json has comments, so it is read as JSONC.
    const { config, error } = parseConfigFileTextToJson(
      "knip.json",
      readFileSync("knip.json", "utf8")
    );
    expect(error).toBeUndefined();
    const { project } = config as { readonly project: readonly string[] };
    const included = project
      .filter(pattern => !pattern.startsWith("!"))
      .map(pattern => pattern.replace(/!$/, ""));
    expect(included.length).toBeGreaterThan(0);
    expect(
      codeFiles.filter(
        path => !included.some(pattern => matchesGlob(path, pattern))
      )
    ).toEqual([]);
  });
});
