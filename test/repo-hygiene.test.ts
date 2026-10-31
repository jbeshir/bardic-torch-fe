import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const root = process.cwd();
const THIS_FILE = "test/repo-hygiene.test.ts";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
) as PackageJson;

const allDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

const FEED_ONLY_DEPENDENCIES = [
  "ai",
  "@ai-sdk/react",
  "vercel-minimax-ai-provider",
  "react-markdown",
  "@remix-run/testing",
];

const FEED_VOCABULARY =
  /alignment|article|minimax|chat_db|recommend(?!ed)|semantic.search|\bfeed\b/i;

const SCANNED_DIRECTORIES = ["app", "functions", "test", "scripts", "e2e"];

const SCANNED_FILES = [
  "package.json",
  "tsconfig.json",
  ".eslintrc.cjs",
  ".prettierrc",
  ".prettierignore",
  ".gitignore",
  ".dev.vars.example",
  "postcss.config.js",
  "tailwind.config.ts",
  "vite.config.ts",
  "playwright.config.ts",
  "load-context.ts",
  "worker-configuration.d.ts",
  "wrangler.toml",
];

function filesUnder(directory: string): string[] {
  return readdirSync(join(root, directory)).flatMap(name => {
    const path = join(directory, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

function scannedFiles(): string[] {
  return [...SCANNED_DIRECTORIES.flatMap(filesUnder), ...SCANNED_FILES]
    .map(path => relative(".", path))
    .filter(path => path !== THIS_FILE && !path.startsWith("e2e/screenshots"));
}

describe("no feed-only dependencies", () => {
  it.each(FEED_ONLY_DEPENDENCIES)("does not depend on %s", name => {
    expect(allDependencies).not.toHaveProperty(name);
  });
});

describe("every dependency pinned exactly", () => {
  it("uses exact semver versions only", () => {
    const exact = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
    const inexact = Object.entries(allDependencies).filter(
      ([, version]) => !exact.test(version)
    );
    expect(inexact).toEqual([]);
  });
});

describe("no feed vocabulary in source/config", () => {
  it("scans a meaningful set of files", () => {
    const files = scannedFiles();
    expect(files).toContain("app/root.tsx");
    expect(files).toContain("wrangler.toml");
    expect(files).toContain("functions/[[path]].ts");
  });

  it("finds no feed vocabulary", () => {
    const offenders = scannedFiles().filter(path =>
      FEED_VOCABULARY.test(readFileSync(join(root, path), "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("no feed-only bindings", () => {
  it("wrangler.toml declares no D1 database", () => {
    const wranglerToml = readFileSync(join(root, "wrangler.toml"), "utf8");
    expect(wranglerToml).not.toMatch(/d1_databases/);
  });
});

/**
 * The original wiki is reached through app/constants/navigation.ts only
 * (DESIGN §5.3), so the catalogue launch is a change to one module. The
 * help content adapted from the wiki (app/content/) and the docs may name
 * it too; navigation's own test pins its URLs.
 */
const WIKI_HOST = "bardictorch.miraheze.org";
const WIKI_HOST_ALLOWED = [
  /^app\/constants\/navigation(\.test)?\.ts$/,
  /^app\/content\//,
  /^docs\//,
  /^(README|CLAUDE)\.md$/,
];

describe("wiki host only in allowed files", () => {
  it("is named in navigation.ts", () => {
    expect(
      readFileSync(join(root, "app/constants/navigation.ts"), "utf8")
    ).toContain(WIKI_HOST);
  });

  it("appears nowhere else in source, tests or config", () => {
    const offenders = scannedFiles().filter(
      path =>
        !WIKI_HOST_ALLOWED.some(allowed => allowed.test(path)) &&
        readFileSync(join(root, path), "utf8").includes(WIKI_HOST)
    );
    expect(offenders).toEqual([]);
  });

  it("allows only the listed places", () => {
    const allowed = (path: string) =>
      WIKI_HOST_ALLOWED.some(pattern => pattern.test(path));
    expect(allowed("app/constants/navigation.ts")).toBe(true);
    expect(allowed("app/content/help/licence.md")).toBe(true);
    expect(allowed("docs/DESIGN.md")).toBe(true);
    expect(allowed("app/styleguide/Content.tsx")).toBe(false);
    expect(allowed("app/constants/navigation.tsx")).toBe(false);
    expect(allowed("test/fixtures/wiki-categories.json")).toBe(false);
  });
});
