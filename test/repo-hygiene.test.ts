import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";
import { filesUnder } from "./support/files";
import { parseConfigFileTextToJson } from "typescript";
import { parse as parseYaml } from "yaml";
import { ENV_NAMES, parseEnv } from "~/server/env.server";

const root = process.cwd();
const THIS_FILE = "test/repo-hygiene.test.ts";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: unknown;
  allowScripts?: Record<string, boolean>;
};

const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
) as PackageJson;

type Lockfile = {
  readonly packages: Readonly<
    Record<
      string,
      { readonly version?: string; readonly hasInstallScript?: boolean }
    >
  >;
};

const lockfile = JSON.parse(
  readFileSync(join(root, "package-lock.json"), "utf8")
) as Lockfile;

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

const SCANNED_DIRECTORIES = ["app", "workers", "test", "scripts", "e2e"];

const SCANNED_FILES = [
  "package.json",
  "tsconfig.json",
  "eslint.config.ts",
  "knip.json",
  ".prettierrc",
  ".prettierignore",
  ".gitignore",
  ".dev.vars.example",
  "postcss.config.js",
  "tailwind.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "react-router.config.ts",
  "playwright.config.ts",
  "worker-configuration.d.ts",
  "wrangler.jsonc",
  ".nvmrc",
  ".github/workflows/ci.yml",
];

function scannedFiles(): string[] {
  return [...SCANNED_DIRECTORIES.flatMap(filesUnder), ...SCANNED_FILES]
    .map(path => relative(".", path))
    .filter(path => path !== THIS_FILE);
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

/**
 * The one override: TypeScript 6 for the packages that still peer `^5`
 * (openapi-typescript; README "Checks" lists them). One entry, so no
 * package gets its own.
 */
describe("dependency overrides", () => {
  it("overrides only typescript, to the root's version", () => {
    expect(packageJson.overrides).toEqual({ typescript: "$typescript" });
  });
});

describe("Playwright", () => {
  it("locks @playwright/test, playwright and playwright-core at one version", () => {
    const versions = Object.entries(lockfile.packages)
      .filter(([path]) =>
        /(^|\/)node_modules\/(@playwright\/test|playwright|playwright-core)$/.test(
          path
        )
      )
      .map(([, entry]) => entry.version);
    expect(versions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(versions)).toEqual(
      new Set([allDependencies["@playwright/test"]])
    );
  });
});

/**
 * npm 12 runs a dependency's install script only if `allowScripts` approves
 * its exact `name@version`. So every locked package with an install script
 * has a deliberate decision, true or false, and a version bump fails here
 * until it is decided again (instead of silently skipping the script). This
 * reads the lockfile, not npm, so it works with any npm.
 */
describe("install scripts", () => {
  const withScripts = [
    ...new Set(
      Object.entries(lockfile.packages)
        .filter(([path, entry]) => path !== "" && entry.hasInstallScript)
        .map(
          ([path, entry]) =>
            `${path.replace(/^.*node_modules\//, "")}@${entry.version}`
        )
    ),
  ].sort();
  const decided = Object.keys(packageJson.allowScripts ?? {}).sort();

  it("decides every locked package that has an install script", () => {
    expect(withScripts.length).toBeGreaterThan(0);
    expect(withScripts.filter(entry => !decided.includes(entry))).toEqual([]);
  });

  it("has no decision for a package the lockfile no longer has", () => {
    expect(decided.filter(entry => !withScripts.includes(entry))).toEqual([]);
  });
});

describe("no feed vocabulary in source/config", () => {
  it("scans a meaningful set of files", () => {
    const files = scannedFiles();
    expect(files).toContain("app/root.tsx");
    expect(files).toContain("wrangler.jsonc");
    expect(files).toContain("workers/app.ts");
  });

  it("finds no feed vocabulary", () => {
    const offenders = scannedFiles().filter(path =>
      FEED_VOCABULARY.test(readFileSync(join(root, path), "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("no feed-only bindings", () => {
  it("wrangler.jsonc declares no D1 database, for either Worker", () => {
    const source = readFileSync(join(root, "wrangler.jsonc"), "utf8");
    expect(source).not.toMatch(/d1_databases/);
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
  readonly on: {
    readonly push?: { readonly branches?: readonly string[] };
    readonly pull_request?: unknown;
  };
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

/** npm 12, as `packageManager` and `allowScripts` assume. */
const INSTALL_NPM = "npm install --global npm@12.2.1";

describe("CI workflow", () => {
  it("has exactly the validate, e2e and audit jobs", () => {
    expect(Object.keys(ciWorkflow.jobs).sort()).toEqual([
      "audit",
      "e2e",
      "validate",
    ]);
  });

  it("installs the npm that packageManager names first in every job", () => {
    expect(
      (JSON.parse(read("package.json")) as { packageManager?: string })
        .packageManager
    ).toBe("npm@12.2.1");
    for (const job of Object.keys(ciWorkflow.jobs)) {
      expect(runsOf(job)[0]).toBe(INSTALL_NPM);
    }
  });

  it("audit installs from the lockfile, then runs npm run audit and checks signatures", () => {
    expect(runsOf("audit")).toEqual([
      INSTALL_NPM,
      "npm ci",
      "npm run audit",
      "npm audit signatures",
    ]);
  });

  it("runs pull requests once, and pushes only to the deployed branches", () => {
    expect(Object.keys(ciWorkflow.on).sort()).toEqual(["pull_request", "push"]);
    expect(ciWorkflow.on.push?.branches).toEqual(["main", "preview"]);
  });

  it("validate installs from the lockfile and runs npm run validate", () => {
    expect(runsOf("validate")).toEqual([
      INSTALL_NPM,
      "npm ci",
      "npm run validate",
    ]);
  });

  it("e2e installs Chromium for the locked Playwright, then runs test:e2e", () => {
    expect(runsOf("e2e")).toEqual([
      INSTALL_NPM,
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

  it("every job uses the Node version in .nvmrc, which is 26.13.0", () => {
    expect(readFileSync(join(root, ".nvmrc"), "utf8").trim()).toBe("26.13.0");
    expect(
      ciWorkflowSource.match(/node-version-file: \.nvmrc$/gm)
    ).toHaveLength(Object.keys(ciWorkflow.jobs).length);
  });
});

const read = (path: string) => readFileSync(join(root, path), "utf8");

/**
 * Set with `wrangler secret put` per Worker (docs/DEPLOY.md), never in the
 * repo. The first two are `secrets.required`, so a deploy fails without
 * them; SENTRY_DSN is optional.
 */
const SECRET_NAMES = [
  "AUTH_SESSION_SECRET",
  "AUTH0_CLIENT_SECRET",
  "SENTRY_DSN",
];
const REQUIRED_SECRET_NAMES = ["AUTH_SESSION_SECRET", "AUTH0_CLIENT_SECRET"];
const OPTIONAL_NAMES = ["SENTRY_DSN", "AUTH_MODE"];
const PLAIN_TEXT_NAMES = ENV_NAMES.filter(
  name => !SECRET_NAMES.includes(name) && !OPTIONAL_NAMES.includes(name)
);

type WorkerConfig = {
  readonly name?: string;
  readonly main?: string;
  readonly compatibility_date?: string;
  readonly compatibility_flags?: readonly string[];
  readonly workers_dev?: boolean;
  readonly preview_urls?: boolean;
  readonly routes?: readonly {
    readonly pattern: string;
    readonly custom_domain?: boolean;
  }[];
  readonly vars?: Readonly<Record<string, string>>;
  readonly secrets?: { readonly required?: readonly string[] };
  readonly d1_databases?: unknown;
  readonly assets?: unknown;
};
type WranglerConfig = WorkerConfig & {
  readonly env?: Readonly<Record<string, WorkerConfig>>;
};

const wranglerSource = read("wrangler.jsonc");
const parsedWrangler = parseConfigFileTextToJson(
  "wrangler.jsonc",
  wranglerSource
);
const wrangler = (parsedWrangler.config ?? {}) as WranglerConfig;

/** The production Worker is the top level; the preview Worker `env.preview`. */
const WORKERS = ["production", "preview"] as const;
type Worker = (typeof WORKERS)[number];
const workerConfig = (worker: Worker): WorkerConfig =>
  worker === "production" ? wrangler : (wrangler.env?.preview ?? {});
const varsOf = (worker: Worker) => workerConfig(worker).vars ?? {};

describe("ops: wrangler.jsonc", () => {
  it("parses as JSON with comments", () => {
    expect(parsedWrangler.error).toBeUndefined();
    expect(wrangler.main).toBe("./workers/app.ts");
  });

  it("has the production Worker at the top level and exactly one other environment, the preview Worker", () => {
    expect(Object.keys(wrangler.env ?? {})).toEqual(["preview"]);
    expect(workerConfig("production").name).toBe("bardic-torch-fe");
    expect(workerConfig("preview").name).toBe("bardic-torch-fe-preview");
  });

  it.each(WORKERS)(
    "%s sets every plain-text variable and no secret",
    worker => {
      expect(Object.keys(varsOf(worker)).sort()).toEqual(
        [...PLAIN_TEXT_NAMES].sort()
      );
    }
  );

  it.each(WORKERS)(
    "%s requires exactly the two secrets, so a deploy without them fails",
    worker => {
      expect(workerConfig(worker).secrets?.required).toEqual(
        REQUIRED_SECRET_NAMES
      );
    }
  );

  const withSecrets = (vars: Readonly<Record<string, string>>) =>
    parseEnv({
      ...vars,
      AUTH_SESSION_SECRET: "a-dashboard-secret-of-at-least-32-characters",
      AUTH0_CLIENT_SECRET: "a-dashboard-secret",
    });
  const placeholders = (worker: Worker) =>
    Object.entries(varsOf(worker))
      .filter(([, value]) => value.startsWith("replace-with"))
      .map(([name]) => name);

  it.each(WORKERS)(
    "%s vars pass env validation once the secrets are added and every placeholder is replaced",
    worker => {
      const filled = Object.fromEntries(
        Object.entries(varsOf(worker)).map(([name, value]) => [
          name,
          value.startsWith("replace-with")
            ? `real-${name.toLowerCase()}`
            : value,
        ])
      );
      expect(withSecrets(filled).ok).toBe(true);
    }
  );

  it.each(WORKERS)(
    "%s vars with a placeholder left fail env validation, naming it (the configuration error page)",
    worker => {
      const parsed = withSecrets(varsOf(worker));
      const left = placeholders(worker);
      if (left.length === 0) {
        expect(parsed.ok).toBe(true);
        return;
      }
      expect(parsed).toEqual({
        ok: false,
        problems: left.map(
          name => `${name}: Still a placeholder: set the real value`
        ),
      });
    }
  );

  it("names no secret value anywhere, and never sets AUTH_MODE", () => {
    for (const worker of WORKERS) {
      const names = Object.keys(varsOf(worker));
      expect(names.filter(name => SECRET_NAMES.includes(name))).toEqual([]);
    }
    // A secret's name is only ever listed as required, never given a value.
    const mentions = [
      ...wranglerSource.matchAll(/"([A-Z0-9_]+)"\s*(:)?/g),
    ].filter(([, name]) => SECRET_NAMES.includes(name!));
    expect(mentions.filter(([, , assigned]) => assigned)).toEqual([]);
    expect(wranglerSource).not.toContain("AUTH_MODE");
  });

  it("builds previews from the preview branch only, as DEPLOY.md and the README say", () => {
    expect(wranglerSource).toContain(
      "// PREVIEW Worker (the `preview` branch only)"
    );
    expect(read("docs/DEPLOY.md")).toContain(
      "**Production branch:** `preview`; **builds for non-production branches:** off."
    );
    const readme = read("README.md");
    expect(readme).toContain(
      "`preview` on the `preview` branch; any other branch fails the build, and an empty branch fails too"
    );
    expect(readme).not.toMatch(/`preview` otherwise/);
  });

  it("returns production sign-ins to bardictorch.org and preview ones to preview.bardictorch.org", () => {
    expect(varsOf("production").AUTH0_DEFAULT_REDIRECT_URI).toBe(
      "https://bardictorch.org"
    );
    expect(varsOf("preview").AUTH0_DEFAULT_REDIRECT_URI).toBe(
      "https://preview.bardictorch.org"
    );
  });

  it.each(WORKERS)(
    "%s is served on its custom domains only: no workers.dev or preview URLs",
    worker => {
      const config = workerConfig(worker);
      expect(config.workers_dev).toBe(false);
      expect(config.preview_urls).toBe(false);
      expect(config.routes).toEqual(
        worker === "production"
          ? [
              { pattern: "bardictorch.org", custom_domain: true },
              { pattern: "www.bardictorch.org", custom_domain: true },
            ]
          : [{ pattern: "preview.bardictorch.org", custom_domain: true }]
      );
    }
  );

  it("uses the compatibility date of the bundled workerd, for both Workers", () => {
    // workerd 1.YYYYMMDD.n supports compatibility dates up to YYYY-MM-DD.
    const workerd = lockfile.packages["node_modules/workerd"]?.version ?? "";
    const supported = /^1\.(\d{4})(\d{2})(\d{2})\.\d+$/
      .exec(workerd)
      ?.slice(1)
      .join("-");
    expect(supported).toBeDefined();
    expect(wrangler.compatibility_date).toBe(supported);
    expect(wrangler.env?.preview?.compatibility_date).toBeUndefined();
  });

  it("enables only nodejs_compat (for @sentry/cloudflare), for both Workers", () => {
    expect(wrangler.compatibility_flags).toEqual(["nodejs_compat"]);
    expect(wrangler.env?.preview?.compatibility_flags).toBeUndefined();
  });

  it("leaves static assets to the Vite plugin, before the Worker", () => {
    // The plugin writes `assets` into the built config (build/server), and
    // a request for a static file never runs the Worker (no
    // `run_worker_first`).
    expect(wrangler.assets).toBeUndefined();
    expect(wranglerSource).not.toContain("run_worker_first");
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

  it("the generated Env declares exactly the plain-text variables and the required secrets; the rest of ENV_NAMES is exactly the optional ones", () => {
    // worker-configuration.d.ts, generated from wrangler.jsonc (gen:types;
    // check:types proves it is up to date).
    const types = read("worker-configuration.d.ts");
    const env = /^interface __BaseEnv_Env \{\n([\s\S]*?)^\}/m.exec(types)?.[1];
    expect(env).toBeDefined();
    const declared = [...(env ?? "").matchAll(/^\s*([A-Z0-9_]+)\??:/gm)].map(
      ([, name]) => name
    );
    expect(declared.sort()).toEqual(
      [...PLAIN_TEXT_NAMES, ...REQUIRED_SECRET_NAMES].sort()
    );
    expect(ENV_NAMES.filter(name => !declared.includes(name)).sort()).toEqual(
      [...OPTIONAL_NAMES].sort()
    );
    expect(types).toMatch(/^interface Env extends __BaseEnv_Env \{\}$/m);
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

  it("has no public/_routes.json: Workers static assets keep every static file away from the Worker", () => {
    expect(existsSync(join(root, "public/_routes.json"))).toBe(false);
    // What it listed is served as a static file, never by the Worker.
    expect(statSync(join(root, "public/favicon.svg")).isFile()).toBe(true);
    expect(statSync(join(root, "public/site.webmanifest")).isFile()).toBe(true);
  });
});

const DOCS = [
  "README.md",
  "CLAUDE.md",
  "docs/DESIGN.md",
  "docs/TESTING.md",
  "docs/DEPLOY.md",
];

/** The node ids of a mermaid flowchart: labels and edge texts removed. */
function flowchartNodes(chart: string): Set<string> {
  const body = chart.split("\n").slice(1).join("\n");
  const ids = body
    .replace(/"[^"]*"/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .match(/\b[A-Za-z]\w*\b/g);
  return new Set(ids ?? []);
}

/** A Markdown table row starting with `cells`, however Prettier pads it. */
function tableRow(cells: readonly string[]): RegExp {
  const escaped = cells.map(cell =>
    cell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`^\\|\\s*${escaped.join("\\s*\\|\\s*")}`, "m");
}

describe("docs", () => {
  it.each(DOCS)("%s exists", path => {
    expect(statSync(join(root, path)).isFile()).toBe(true);
  });

  it("README has one top-down mermaid flowchart under 12 nodes, unstyled", () => {
    const charts = [
      ...read("README.md").matchAll(/```mermaid\n([\s\S]*?)```/g),
    ].map(([, chart]) => chart!);
    expect(charts).toHaveLength(1);
    const chart = charts[0]!;
    expect(chart.split("\n")[0]).toBe("flowchart TD");
    expect(chart).not.toMatch(/^\s*(style|classDef|class|linkStyle)\b/m);
    const nodes = flowchartNodes(chart);
    expect(nodes.size).toBeGreaterThan(1);
    expect(nodes.size).toBeLessThan(12);
  });

  it("counts flowchart nodes, not labels", () => {
    expect(
      flowchartNodes(
        'flowchart TD\n  A["Label words"] -- "edge text" --> B\n  B --> C\n'
      )
    ).toEqual(new Set(["A", "B", "C"]));
  });

  it("CLAUDE.md gives the validation commands, the e2e recipe and the manual checks", () => {
    const claude = read("CLAUDE.md");
    for (const text of [
      "npm run validate",
      "npm run test:e2e",
      "npx playwright install --with-deps chromium",
      "1.61.1",
      "**Theming.**",
      "**Error handling.**",
      "**Accessibility.**",
    ]) {
      expect(claude).toContain(text);
    }
    const workers = /workers: (\d+),/.exec(read("playwright.config.ts"))?.[1];
    expect(claude).toContain(`Workers are fixed at ${workers}`);
  });

  it("TESTING.md records that e2e is separate from validate (PLAN §9)", () => {
    const testing = read("docs/TESTING.md");
    expect(testing).toContain("## Deviation from the product plan (PLAN §9)");
    expect(testing).toContain("**`npm run test:e2e` is a separate command**");
  });

  it.each(DOCS)("every npm script %s names exists", path => {
    const scripts = Object.keys(
      (JSON.parse(read("package.json")) as { scripts: Record<string, string> })
        .scripts
    );
    const named = [...read(path).matchAll(/npm run ([a-z][\w:-]*)/g)].map(
      ([, script]) => script
    );
    expect(named.filter(script => !scripts.includes(script!))).toEqual([]);
  });

  it.each(DOCS)("every cookie %s names is set by the app", path => {
    const appSource = filesUnder("app")
      .filter(file => !/\.test\.tsx?$/.test(file))
      .map(file => read(file))
      .join("\n");
    const cookies = [...read(path).matchAll(/__Host-[\w-]+/g)].map(
      ([cookie]) => cookie
    );
    expect(
      cookies.filter(cookie => !appSource.includes(`"${cookie}"`))
    ).toEqual([]);
  });

  it("DEPLOY.md covers every variable, the build and both sign-in origins", () => {
    const deploy = read("docs/DEPLOY.md");
    for (const name of ENV_NAMES) expect(deploy).toContain(`\`${name}\``);
    expect(deploy).toContain("`npm run build:ci`");
    expect(deploy).toMatch(tableRow(["build command", "`npm run build:ci`"]));
    expect(deploy).toMatch(
      tableRow(["deploy command", "`npx wrangler deploy`"])
    );
    for (const worker of WORKERS) {
      const origin = varsOf(worker).AUTH0_DEFAULT_REDIRECT_URI;
      expect(deploy).toContain(`\`${origin}/auth/callback\``);
      expect(deploy).toContain(`\`${origin}\``);
    }
    for (const secret of SECRET_NAMES) {
      expect(deploy).toMatch(tableRow([`\`${secret}\``, "**secret**"]));
    }
  });
});

describe("formatting coverage", () => {
  /**
   * Everything else in the repository is Prettier-formatted. The lockfile
   * and generated output are not ours to format, and api/openapi.yaml is
   * vendored byte for byte from the backend by `npm run sync:api`
   * (AMENDMENTS A1): Prettier would rewrite its blank lines, so the copy
   * would no longer match the backend's. Any new entry must be added here
   * on purpose, so .prettierignore can't quietly hide our own code.
   */
  const EXPECTED_PRETTIER_IGNORES = [
    "node_modules/",
    "build*/",
    ".cache/",
    ".wrangler/",
    "playwright-report/",
    "test-results/",
    "e2e/screenshots/",
    "package-lock.json",
    "api/openapi.yaml",
  ];

  it(".prettierignore lists exactly the expected entries", () => {
    const entries = read(".prettierignore")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "" && !line.startsWith("#"));
    expect(entries).toEqual(EXPECTED_PRETTIER_IGNORES);
  });
});

describe("error copy", () => {
  /**
   * The app speaks as "we" in every error ("We couldn’t save your
   * changes."), never in the third person about itself (review CQ-10).
   */
  const THIRD_PERSON = /Bardic Torch (?:couldn’t|could not|sent|took|failed)/;
  /** JSX copy that starts "Couldn’t…", with no subject at all (UI only; logs may). */
  const NO_SUBJECT = /(?:^|>)\s*Couldn’t /m;

  it("uses one voice: “We couldn’t…”, not “Bardic Torch couldn’t…”", () => {
    const offenders = filesUnder("app").filter(
      path =>
        /\.tsx?$/.test(path) &&
        !/\.test\.tsx?$/.test(path) &&
        (THIRD_PERSON.test(read(path)) ||
          (path.endsWith(".tsx") && NO_SUBJECT.test(read(path))))
    );
    expect(offenders).toEqual([]);
  });

  it("recognises the third-person voice and a missing subject", () => {
    expect(THIRD_PERSON.test("Bardic Torch couldn’t do that.")).toBe(true);
    expect(THIRD_PERSON.test("We couldn’t do that.")).toBe(false);
    expect(NO_SUBJECT.test("<span>Couldn’t load these details.</span>")).toBe(
      true
    );
    expect(NO_SUBJECT.test("  Couldn’t save your theme.")).toBe(true);
    expect(NO_SUBJECT.test('"We couldn’t save."')).toBe(false);
  });
});

/**
 * Every Playwright API request goes through the per-test `request` fixture
 * or `page.request`, which are disposed when the test ends: an API context
 * that outlived its test would keep keep-alive sockets open across tests
 * (docs/TESTING.md, "socket hang up").
 */
describe("e2e API requests", () => {
  it("never creates an APIRequestContext of its own", () => {
    const own =
      /\bnewContext\s*\(|import\s*\{[^}]*\brequest\b[^}]*\}\s*from\s*"@playwright\/test"/;
    expect(filesUnder("e2e").filter(path => own.test(read(path)))).toEqual([]);
  });
});

/**
 * @eslint-react's `dom-no-unsafe-target-blank` checks plain `<a>` only, and
 * it has no setting to add `Link` or `NavLink` (eslintrc's
 * `linkComponents`). No link opens a new tab (DESIGN §5.3: the same tab), so
 * no link component may take a `target`.
 */
describe("links", () => {
  it("never give a link component a target", () => {
    const linkWithTarget = /<\w*Link\b[^>]*\starget=/;
    expect(
      filesUnder("app").filter(
        path => /\.tsx$/.test(path) && linkWithTarget.test(read(path))
      )
    ).toEqual([]);
  });
});
