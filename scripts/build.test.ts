import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkBuiltWorker,
  removeEmittedDevVars,
  selectBuildMode,
} from "./build.mjs";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** A build output whose config deploys to Worker `name`. */
function builtFor(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bt-build-"));
  dirs.push(dir);
  mkdirSync(path.join(dir, "server"));
  writeFileSync(
    path.join(dir, "server", "wrangler.json"),
    JSON.stringify({ name, main: "index.js" })
  );
  return dir;
}

describe("selectBuildMode", () => {
  it.each([
    ["main", "production"],
    ["preview", "preview"],
  ])("builds branch %s for %s", (branch, mode) => {
    expect(selectBuildMode({ WORKERS_CI_BRANCH: branch })).toBe(mode);
  });

  it.each(["milestone/fe1-foundation", "Main", "master"])(
    "refuses to build branch %s, naming it",
    branch => {
      expect(() => selectBuildMode({ WORKERS_CI_BRANCH: branch })).toThrow(
        `Branch "${branch}" is not deployed`
      );
    }
  );

  it.each([{}, { WORKERS_CI_BRANCH: "" }])(
    "fails closed on %j: no guessed deploy target",
    env => {
      expect(() => selectBuildMode(env)).toThrow(
        "WORKERS_CI_BRANCH is empty: refusing to guess a deploy target"
      );
    }
  );
});

describe("checkBuiltWorker", () => {
  const PRODUCTION = "bardic-torch-fe";
  const PREVIEW = "bardic-torch-fe-preview";

  it.each([
    ["production", PRODUCTION, {}, 0],
    ["preview", PREVIEW, {}, 0],
    ["production", PREVIEW, {}, 1],
    ["preview", PRODUCTION, {}, 1],
    ["preview", PREVIEW, { WRANGLER_CI_OVERRIDE_NAME: PREVIEW }, 0],
    ["production", PRODUCTION, { WRANGLER_CI_OVERRIDE_NAME: PREVIEW }, 1],
    ["preview", PREVIEW, { WRANGLER_CI_OVERRIDE_NAME: "" }, 1],
  ] as const)(
    "%s build of Worker %s with %j has %i problems",
    (mode, worker, env, problems) => {
      expect(
        checkBuiltWorker({ buildDir: builtFor(worker), mode, env })
      ).toHaveLength(problems);
    }
  );

  it("fails a build with no built config", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bt-build-"));
    dirs.push(dir);
    expect(
      checkBuiltWorker({ buildDir: dir, mode: "production", env: {} })
    ).toEqual([`production: no ${path.join(dir, "server", "wrangler.json")}`]);
  });
});

describe("removeEmittedDevVars", () => {
  it("deletes the .dev.vars copy the Cloudflare plugin writes into the build", () => {
    const dir = builtFor("bardic-torch-fe");
    const copy = path.join(dir, "server", ".dev.vars");
    writeFileSync(copy, "AUTH_SESSION_SECRET=a-local-secret\n");
    removeEmittedDevVars(dir);
    expect(existsSync(copy)).toBe(false);
    expect(existsSync(path.join(dir, "server", "wrangler.json"))).toBe(true);
    // Nothing to delete is fine too.
    removeEmittedDevVars(dir);
  });
});
