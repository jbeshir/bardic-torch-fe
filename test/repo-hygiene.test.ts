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
  readonly compatibility_flags?: readonly string[];
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

  const withSecrets = (vars: Readonly<Record<string, string>>) =>
    parseEnv({
      ...vars,
      AUTH_SESSION_SECRET: "a-dashboard-secret-of-at-least-32-characters",
      AUTH0_CLIENT_SECRET: "a-dashboard-secret",
    });
  const placeholders = (environment: string) =>
    Object.entries(varsOf(environment))
      .filter(([, value]) => value.startsWith("replace-with"))
      .map(([name]) => name);

  it.each(["preview", "production"])(
    "%s vars pass env validation once the secrets are added and every placeholder is replaced",
    environment => {
      const filled = Object.fromEntries(
        Object.entries(varsOf(environment)).map(([name, value]) => [
          name,
          value.startsWith("replace-with")
            ? `real-${name.toLowerCase()}`
            : value,
        ])
      );
      expect(withSecrets(filled).ok).toBe(true);
    }
  );

  it.each(["preview", "production"])(
    "%s vars with a placeholder left fail env validation, naming it (the configuration error page)",
    environment => {
      const parsed = withSecrets(varsOf(environment));
      const left = placeholders(environment);
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

  it("enables only nodejs_als (for @sentry/cloudflare), as the e2e server does", () => {
    expect(wrangler.compatibility_flags).toEqual(["nodejs_als"]);
    expect(read("playwright.config.ts")).toContain(
      'const COMPATIBILITY_FLAGS = "nodejs_als";'
    );
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
    expect(deploy).toContain("`npm run build:pages`");
    const outputDirectory = wrangler.pages_build_output_dir?.replace(
      /^\.\//,
      ""
    );
    expect(deploy).toMatch(
      tableRow(["build output directory", `\`${outputDirectory}\``])
    );
    for (const environment of ["production", "preview"]) {
      const origin = varsOf(environment).AUTH0_DEFAULT_REDIRECT_URI;
      expect(deploy).toContain(`\`${origin}/auth/callback\``);
      expect(deploy).toContain(`\`${origin}\``);
    }
    for (const secret of SECRET_NAMES) {
      expect(deploy).toMatch(tableRow([`\`${secret}\``, "**secret**"]));
    }
  });
});
