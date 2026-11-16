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
import { removeEmittedDevVars, selectBuildMode } from "./build.mjs";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** A build output with a built config. */
function builtDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bt-build-"));
  dirs.push(dir);
  mkdirSync(path.join(dir, "server"));
  writeFileSync(
    path.join(dir, "server", "wrangler.json"),
    JSON.stringify({ name: "bardic-torch-fe", main: "index.js" })
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

describe("removeEmittedDevVars", () => {
  it("deletes the .dev.vars copy the Cloudflare plugin writes into the build", () => {
    const dir = builtDir();
    const copy = path.join(dir, "server", ".dev.vars");
    writeFileSync(copy, "AUTH_SESSION_SECRET=a-local-secret\n");
    removeEmittedDevVars(dir);
    expect(existsSync(copy)).toBe(false);
    expect(existsSync(path.join(dir, "server", "wrangler.json"))).toBe(true);
    // Nothing to delete is fine too.
    removeEmittedDevVars(dir);
  });
});
