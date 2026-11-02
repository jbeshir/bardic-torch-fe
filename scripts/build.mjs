import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run build` / `build:preview` / `build:e2e`: `node scripts/build.mjs
 * <mode>`. `npm run build:ci`, the Workers Builds build command:
 * `node scripts/build.mjs --from-branch`, which picks the mode from the
 * branch being built (docs/DEPLOY.md §2).
 *
 * The mode decides three things: which routes there are (BT_BUILD_MODE,
 * app/routes.ts: the styleguide is left out of production), whether stub
 * sign-in is compiled in (the Vite mode, vite.config.ts: e2e only), and
 * which Worker the built config deploys to (CLOUDFLARE_ENV: `preview`
 * selects wrangler.jsonc's `env.preview`, the bardic-torch-fe-preview
 * Worker). Then it checks the built config names the Worker it should, and
 * deletes the `.dev.vars` copy the Cloudflare plugin writes next to it.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** What each build mode builds, and for which Worker. */
export const BUILD_MODES = {
  production: { cloudflareEnv: undefined, worker: "bardic-torch-fe" },
  preview: { cloudflareEnv: "preview", worker: "bardic-torch-fe-preview" },
  // Served locally by `wrangler dev` (playwright.config.ts); never deployed.
  e2e: { cloudflareEnv: undefined, worker: "bardic-torch-fe" },
};

/**
 * The only branches Workers Builds builds (docs/DEPLOY.md §2): `main` is
 * the production Worker, `preview` the preview Worker.
 */
const MODE_BY_BRANCH = new Map([
  ["main", "production"],
  ["preview", "preview"],
]);

/**
 * Pick the build mode for a Workers Builds build from WORKERS_CI_BRANCH:
 * production for `main`, preview for `preview`. It fails closed: any other
 * branch is refused (a preview build runs with the preview Worker's
 * secrets, so only the `preview` branch gets one), and so is a missing or
 * empty branch, because the mode decides which Worker is deployed.
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {"production" | "preview"}
 */
export function selectBuildMode(env) {
  const branch = env.WORKERS_CI_BRANCH;
  if (branch === undefined || branch === "") {
    throw new Error(
      "WORKERS_CI_BRANCH is empty: refusing to guess a deploy target. Local builds name their mode: npm run build, npm run build:preview."
    );
  }
  const mode = MODE_BY_BRANCH.get(branch);
  if (mode === undefined) {
    throw new Error(
      `Branch "${branch}" is not deployed: Workers Builds builds only main (production) and preview. See docs/DEPLOY.md §2.`
    );
  }
  return mode;
}

/**
 * The process environment of `react-router build` for `mode`: BT_BUILD_MODE,
 * and CLOUDFLARE_ENV only for the preview Worker. An inherited
 * CLOUDFLARE_ENV is dropped, so a stray export can't build production code
 * for another Worker.
 * @param {keyof typeof BUILD_MODES} mode
 * @param {Readonly<Record<string, string | undefined>>} env
 */
export function buildEnvironment(mode, env) {
  const inherited = { ...env };
  delete inherited.CLOUDFLARE_ENV;
  const { cloudflareEnv } = BUILD_MODES[mode];
  return {
    ...inherited,
    BT_BUILD_MODE: mode,
    ...(cloudflareEnv ? { CLOUDFLARE_ENV: cloudflareEnv } : {}),
  };
}

/**
 * Problems with the build in `buildDir` for `mode`: the Worker its built
 * config (`server/wrangler.json`) deploys to must be the mode's. It must
 * also be the Worker in WRANGLER_CI_OVERRIDE_NAME when that is set: wrangler
 * deploy would deploy the build under that name instead, warning only, so
 * the preview connection could deploy a production build, or the reverse.
 * Without it, wrangler's own WRANGLER_CI_MATCH_TAG check refuses a build
 * whose name isn't the connection's Worker (docs/DEPLOY.md §2).
 * @param {{ buildDir: string, mode: keyof typeof BUILD_MODES, env: Readonly<Record<string, string | undefined>> }} options
 * @returns {string[]}
 */
export function checkBuiltWorker({ buildDir, mode, env }) {
  const file = path.join(buildDir, "server", "wrangler.json");
  if (!existsSync(file)) return [`${mode}: no ${file}`];
  const { name } = JSON.parse(readFileSync(file, "utf8"));
  const expected = BUILD_MODES[mode].worker;
  const problems = [];
  if (name !== expected) {
    problems.push(
      `${mode}: the build deploys to Worker "${name}", not "${expected}"`
    );
  }
  const override = env.WRANGLER_CI_OVERRIDE_NAME;
  if (override !== undefined && override !== name) {
    problems.push(
      `${mode}: WRANGLER_CI_OVERRIDE_NAME would deploy the build to Worker "${override}", but it is for "${name}"`
    );
  }
  return problems;
}

/**
 * Delete the `.dev.vars` the Cloudflare plugin copies into the build from
 * the local .dev.vars (or the process environment): no deploy reads it,
 * e2e passes every binding with `--var`, and a local secret must never be
 * left in a build output.
 * @param {string} buildDir
 */
export function removeEmittedDevVars(buildDir) {
  rmSync(path.join(buildDir, "server", ".dev.vars"), { force: true });
}

/**
 * Build `mode` into `buildDir` (react-router.config.ts reads
 * BT_BUILD_DIRECTORY), check it, and return the problems.
 * @param {keyof typeof BUILD_MODES} mode
 * @param {{ buildDir?: string, env?: Readonly<Record<string, string | undefined>>, stdio?: "inherit" | "pipe" }} [options]
 * @returns {string[]}
 */
export function build(
  mode,
  {
    buildDir = path.join(ROOT, "build"),
    env = process.env,
    stdio = "inherit",
  } = {}
) {
  const result = spawnSync(
    path.join(ROOT, "node_modules/.bin/react-router"),
    ["build", "--mode", mode],
    {
      cwd: ROOT,
      stdio,
      encoding: "utf8",
      env: { ...buildEnvironment(mode, env), BT_BUILD_DIRECTORY: buildDir },
    }
  );
  removeEmittedDevVars(buildDir);
  if (result.status !== 0) {
    return [
      `${mode} build failed${stdio === "pipe" ? `:\n${result.stdout}${result.stderr}` : ""}`,
    ];
  }
  return checkBuiltWorker({ buildDir, mode, env });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [argument] = process.argv.slice(2);
    const mode =
      argument === "--from-branch" ? selectBuildMode(process.env) : argument;
    if (!Object.hasOwn(BUILD_MODES, mode ?? "")) {
      throw new Error(
        `Usage: node scripts/build.mjs ${Object.keys(BUILD_MODES).join("|")}|--from-branch`
      );
    }
    console.log(`Building in ${mode} mode for ${BUILD_MODES[mode].worker}`);
    const problems = build(mode);
    if (problems.length > 0) {
      console.error(problems.join("\n"));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
