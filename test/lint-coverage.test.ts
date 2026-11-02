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

type RuleEntry = readonly [
  severity: number,
  options?: { readonly allowInterfaces?: string },
];
const ERROR = 2;

// knip.json has comments, so it is read as JSONC.
const knipSource = parseConfigFileTextToJson(
  "knip.json",
  readFileSync("knip.json", "utf8")
);
const knipConfig = knipSource.config as {
  readonly entry: readonly string[];
  readonly project: readonly string[];
};

/** Tools run by hand, as their headers say, not by an npm script. */
const MANUAL_TOOLS = [
  "scripts/font-fallback-metrics.mjs",
  "scripts/wiki-categories.mjs",
];

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

  it(
    "allows an interface that only extends another in the generated worker-configuration.d.ts alone",
    { timeout: 60_000 },
    async () => {
      const eslint = new ESLint();
      const options = async (path: string) =>
        (
          (await eslint.calculateConfigForFile(path)) as {
            readonly rules?: Readonly<Record<string, RuleEntry>>;
          }
        ).rules?.["@typescript-eslint/no-empty-object-type"];
      expect(await options("worker-configuration.d.ts")).toEqual([
        ERROR,
        { allowInterfaces: "with-single-extends" },
      ]);
      const loosened: string[] = [];
      for (const path of codeFiles.filter(
        file => /\.tsx?$/.test(file) && file !== "worker-configuration.d.ts"
      )) {
        const entry = await options(path);
        // The rule's default: no empty interface, whatever it extends.
        const allowed = entry?.[1]?.allowInterfaces ?? "never";
        if (entry?.[0] !== ERROR || allowed !== "never") {
          loosened.push(path);
        }
      }
      expect(loosened).toEqual([]);
    }
  );

  it("puts every code file in knip's project", () => {
    expect(knipSource.error).toBeUndefined();
    const { project } = knipConfig;
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

describe("knip entries", () => {
  it("declares exactly the scripts package.json runs and the manual tools, so an unused script is an unused file", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
      readonly scripts: Readonly<Record<string, string>>;
    };
    const run = Object.values(scripts).flatMap(command =>
      [...command.matchAll(/(?:^|\s)(scripts\/[\w.-]+\.mjs)\b/g)].map(
        ([, path = ""]) => path
      )
    );
    const declared = knipConfig.entry
      .filter(entry => entry.startsWith("scripts/"))
      .map(entry => entry.replace(/!$/, ""));
    expect(declared.filter(entry => /[*?{[]/.test(entry))).toEqual([]);
    expect([...declared].sort()).toEqual(
      [...new Set([...run, ...MANUAL_TOOLS])].sort()
    );
    for (const tool of MANUAL_TOOLS) {
      expect(readFileSync(tool, "utf8")).toContain(`node ${tool}`);
    }
  });
});
