import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";

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
  ".nvmrc",
  ".github/workflows/ci.yml",
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

type WorkflowStep = {
  readonly uses?: string;
  readonly run?: string;
  readonly with?: { readonly path?: string };
};
type Workflow = {
  readonly jobs: Readonly<
    Record<string, { readonly steps: readonly WorkflowStep[] }>
  >;
};

const ciWorkflowSource = readFileSync(
  join(root, ".github/workflows/ci.yml"),
  "utf8"
);
const ciWorkflow = parseYaml(ciWorkflowSource) as Workflow;

function stepsOf(job: string): readonly WorkflowStep[] {
  return ciWorkflow.jobs[job]?.steps ?? [];
}

function runsOf(job: string): string[] {
  return stepsOf(job).flatMap(step => (step.run ? [step.run] : []));
}

describe("CI workflow", () => {
  it("has exactly the validate and e2e jobs", () => {
    expect(Object.keys(ciWorkflow.jobs).sort()).toEqual(["e2e", "validate"]);
  });

  it("validate installs from the lockfile and runs npm run validate", () => {
    expect(runsOf("validate")).toEqual(["npm ci", "npm run validate"]);
  });

  it("e2e installs Chromium for the locked Playwright, then runs test:e2e", () => {
    expect(runsOf("e2e")).toEqual([
      "npm ci",
      "npx playwright install --with-deps chromium",
      "npm run test:e2e",
    ]);
    expect(allDependencies["@playwright/test"]).toBe("1.61.1");
  });

  it("e2e uploads the report, the screenshots and the test results", () => {
    const uploaded = stepsOf("e2e").flatMap(step =>
      step.uses?.startsWith("actions/upload-artifact@") && step.with?.path
        ? [step.with.path]
        : []
    );
    expect(uploaded).toEqual([
      "playwright-report/",
      "e2e/screenshots/",
      "test-results/",
    ]);
  });

  it("pins every action to an exact release tag", () => {
    const uses = Object.keys(ciWorkflow.jobs).flatMap(job =>
      stepsOf(job).flatMap(step => (step.uses ? [step.uses] : []))
    );
    expect(uses.length).toBeGreaterThan(0);
    expect(
      uses.filter(use => !/^[\w-]+\/[\w-]+@v\d+\.\d+\.\d+$/.test(use))
    ).toEqual([]);
  });

  it("needs no secrets", () => {
    expect(ciWorkflowSource).not.toMatch(/secrets\./);
  });

  it("both jobs use the Node version in .nvmrc, which is 22", () => {
    expect(readFileSync(join(root, ".nvmrc"), "utf8").trim()).toBe("22");
    expect(
      ciWorkflowSource.match(/node-version-file: \.nvmrc$/gm)
    ).toHaveLength(2);
  });
});
