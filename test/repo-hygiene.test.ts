import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { ENV_NAMES, parseEnv } from "~/server/env.server";

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

const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Set in the Pages dashboard (docs/DEPLOY.md), never in the repo. */
const SECRET_NAMES = [
  "AUTH_SESSION_SECRET",
  "AUTH0_CLIENT_SECRET",
  "SENTRY_DSN",
];
const OPTIONAL_NAMES = ["SENTRY_DSN", "AUTH_MODE"];
const PLAIN_TEXT_NAMES = ENV_NAMES.filter(
  name => !SECRET_NAMES.includes(name) && !OPTIONAL_NAMES.includes(name)
);

type WranglerConfig = {
  readonly compatibility_date?: string;
  readonly pages_build_output_dir?: string;
  readonly vars?: unknown;
  readonly env?: Readonly<
    Record<string, { readonly vars?: Readonly<Record<string, string>> }>
  >;
};

const wrangler = parseToml(read("wrangler.toml")) as WranglerConfig;
const varsOf = (environment: string) => wrangler.env?.[environment]?.vars ?? {};

describe("ops: wrangler.toml", () => {
  it("has exactly a preview and a production environment, and no top-level vars", () => {
    expect(Object.keys(wrangler.env ?? {}).sort()).toEqual([
      "preview",
      "production",
    ]);
    expect(wrangler.vars).toBeUndefined();
  });

  it.each(["preview", "production"])(
    "%s sets every plain-text variable and no secret",
    environment => {
      expect(Object.keys(varsOf(environment)).sort()).toEqual(
        [...PLAIN_TEXT_NAMES].sort()
      );
    }
  );

  it.each(["preview", "production"])(
    "%s vars pass env validation once the secrets are added",
    environment => {
      const parsed = parseEnv({
        ...varsOf(environment),
        AUTH_SESSION_SECRET: "a-dashboard-secret-of-at-least-32-characters",
        AUTH0_CLIENT_SECRET: "a-dashboard-secret",
      });
      expect(parsed.ok).toBe(true);
    }
  );

  it("names no secret anywhere, and never sets AUTH_MODE", () => {
    const source = read("wrangler.toml");
    const assigned = [...source.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map(
      match => match[1]
    );
    expect(assigned.filter(name => SECRET_NAMES.includes(name!))).toEqual([]);
    expect(assigned).not.toContain("AUTH_MODE");
  });

  it("returns production sign-ins to bardictorch.org and preview ones elsewhere", () => {
    const production = varsOf("production").AUTH0_DEFAULT_REDIRECT_URI;
    const preview = varsOf("preview").AUTH0_DEFAULT_REDIRECT_URI;
    expect(production).toBe("https://bardictorch.org");
    expect(preview).toMatch(
      /^https:\/\/[a-z0-9-]+\.bardic-torch-fe\.pages\.dev$/
    );
    expect(preview).not.toBe(production);
  });

  it("serves build/client with the compatibility date the e2e server uses", () => {
    expect(wrangler.pages_build_output_dir).toBe("./build/client");
    const e2eDate = /COMPATIBILITY_DATE = "([\d-]+)"/.exec(
      read("playwright.config.ts")
    )?.[1];
    expect(e2eDate).toBeDefined();
    expect(wrangler.compatibility_date).toBe(e2eDate);
  });
});

describe("ops: local variables", () => {
  const example = read(".dev.vars.example");
  const entries = [...example.matchAll(/^(# )?([A-Z0-9_]+)=(.*)$/gm)].map(
    ([, commented, name, value]) => ({ commented: !!commented, name, value })
  );

  it(".dev.vars.example names every variable, the optional ones commented out", () => {
    expect(entries.map(entry => entry.name).sort()).toEqual(
      [...ENV_NAMES].sort()
    );
    expect(
      entries.filter(entry => entry.commented).map(entry => entry.name)
    ).toEqual(OPTIONAL_NAMES);
  });

  it(".dev.vars.example holds placeholders only", () => {
    const secrets = entries.filter(entry => SECRET_NAMES.includes(entry.name!));
    expect(secrets).toHaveLength(SECRET_NAMES.length);
    for (const secret of secrets) expect(secret.value).toMatch(/replace-with/);
    expect(
      entries.find(entry => entry.name === "AUTH0_CLIENT_ID")?.value
    ).toMatch(/^replace-with/);
  });

  it(".dev.vars is gitignored", () => {
    expect(read(".gitignore").split("\n")).toContain(".dev.vars");
  });

  it("worker-configuration.d.ts declares every variable, only the optional ones optional", () => {
    const declared = [
      ...read("worker-configuration.d.ts").matchAll(
        /^\s*([A-Z0-9_]+)(\?)?: string;$/gm
      ),
    ];
    expect(declared.map(([, name]) => name).sort()).toEqual(
      [...ENV_NAMES].sort()
    );
    expect(
      declared.filter(([, , optional]) => optional).map(([, name]) => name)
    ).toEqual(OPTIONAL_NAMES);
  });
});

describe("ops: static files", () => {
  it("public/_headers only sets caching", () => {
    const rules = read("public/_headers")
      .split("\n")
      .filter(line => line.trim() !== "" && !line.startsWith("#"));
    const paths = rules.filter(line => !/^\s/.test(line));
    const headerNames = rules
      .filter(line => /^\s/.test(line))
      .map(line => line.trim().split(":")[0]);
    expect(paths).toEqual(["/assets/*"]);
    expect(headerNames).toEqual(["Cache-Control"]);
  });

  it("public/_routes.json keeps only static files away from the Pages Function", () => {
    const routes = JSON.parse(read("public/_routes.json")) as {
      version: number;
      include: string[];
      exclude: string[];
    };
    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(["/*"]);
    expect(routes.exclude).toContain("/assets/*");
    const files = routes.exclude.filter(path => path !== "/assets/*");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(statSync(join(root, "public", file)).isFile()).toBe(true);
    }
  });
});
