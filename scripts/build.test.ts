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
  BUILD_MODES,
  buildEnvironment,
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
  it("uses production for the main branch", () => {
    expect(selectBuildMode({ WORKERS_CI_BRANCH: "main" })).toBe("production");
  });

  it("uses preview for the preview branch", () => {
    expect(selectBuildMode({ WORKERS_CI_BRANCH: "preview" })).toBe("preview");
  });

  it.each([
    "milestone/fe1-foundation",
    "feature/x",
    "Main",
    "master",
    "Preview",
  ])("refuses to build branch %s, naming it", branch => {
    expect(() => selectBuildMode({ WORKERS_CI_BRANCH: branch })).toThrow(
      `Branch "${branch}" is not deployed`
    );
  });

  it("fails closed when the variable is missing: no guessed deploy target", () => {
    expect(() => selectBuildMode({})).toThrow(
      "WORKERS_CI_BRANCH is empty: refusing to guess a deploy target"
    );
  });

  it("fails closed when the variable is empty: no guessed deploy target", () => {
    expect(() => selectBuildMode({ WORKERS_CI_BRANCH: "" })).toThrow(
      "WORKERS_CI_BRANCH is empty: refusing to guess a deploy target"
    );
  });
});

describe("buildEnvironment", () => {
  it.each([
    ["production", undefined],
    ["preview", "preview"],
    ["e2e", undefined],
  ] as const)("builds %s with CLOUDFLARE_ENV %s", (mode, cloudflareEnv) => {
    const env = buildEnvironment(mode, { PATH: "/bin" });
    expect(env).toEqual({
      PATH: "/bin",
      ...(cloudflareEnv ? { CLOUDFLARE_ENV: cloudflareEnv } : {}),
    });
  });

  it("drops an inherited CLOUDFLARE_ENV, so production can't be built for another Worker", () => {
    expect(
      buildEnvironment("production", { CLOUDFLARE_ENV: "preview" })
    ).toEqual({});
  });
});

describe("checkBuiltWorker", () => {
  it.each(
    Object.entries(BUILD_MODES).map(([mode, { worker }]) => [mode, worker])
  )("passes a %s build that deploys to %s", (mode, worker) => {
    expect(
      checkBuiltWorker({
        buildDir: builtFor(worker),
        mode: mode as keyof typeof BUILD_MODES,
        env: {},
      })
    ).toEqual([]);
  });

  it("fails a build that deploys to the other Worker", () => {
    expect(
      checkBuiltWorker({
        buildDir: builtFor("bardic-torch-fe"),
        mode: "preview",
        env: {},
      })
    ).toEqual([
      'preview: the build deploys to Worker "bardic-torch-fe", not "bardic-torch-fe-preview"',
    ]);
    expect(
      checkBuiltWorker({
        buildDir: builtFor("bardic-torch-fe-preview"),
        mode: "production",
        env: {},
      })
    ).toEqual([
      'production: the build deploys to Worker "bardic-torch-fe-preview", not "bardic-torch-fe"',
    ]);
  });

  it("fails a build that WRANGLER_CI_OVERRIDE_NAME would deploy to another Worker", () => {
    expect(
      checkBuiltWorker({
        buildDir: builtFor("bardic-torch-fe"),
        mode: "production",
        env: {
          WORKERS_CI: "1",
          WRANGLER_CI_OVERRIDE_NAME: "bardic-torch-fe-preview",
        },
      })
    ).toEqual([
      'production: WRANGLER_CI_OVERRIDE_NAME would deploy the build to Worker "bardic-torch-fe-preview", but it is for "bardic-torch-fe"',
    ]);
    // Set but empty is a name too: wrangler would use it, so it fails.
    expect(
      checkBuiltWorker({
        buildDir: builtFor("bardic-torch-fe-preview"),
        mode: "preview",
        env: { WRANGLER_CI_OVERRIDE_NAME: "" },
      })
    ).toHaveLength(1);
  });

  it("passes a build whose WRANGLER_CI_OVERRIDE_NAME is its own Worker", () => {
    expect(
      checkBuiltWorker({
        buildDir: builtFor("bardic-torch-fe-preview"),
        mode: "preview",
        env: { WRANGLER_CI_OVERRIDE_NAME: "bardic-torch-fe-preview" },
      })
    ).toEqual([]);
  });

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
