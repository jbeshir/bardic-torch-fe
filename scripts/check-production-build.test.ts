import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { inspectBuild, readStubMarker } from "./check-production-build.mjs";

const MARKER = "bardic-torch-stub-auth";
const dirs: string[] = [];

/** A fake build output directory with the given files. */
function fakeBuild(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bt-inspect-"));
  dirs.push(dir);
  const all = {
    "server/index.js": 'const routes = { "routes/_index": {} };',
    "client/assets/manifest-abc.js":
      'window.__remixManifest={"routes/_index":{}}',
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function inspect(
  files: Record<string, string>,
  mode: "production" | "preview" = "production"
) {
  return inspectBuild({ buildDir: fakeBuild(files), mode, marker: MARKER });
}

const STYLEGUIDE = {
  "server/index.js": 'const routes = { "routes/styleguide": {} };',
  "client/assets/manifest-abc.js":
    'window.__remixManifest={"routes/styleguide":{}}',
};

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("readStubMarker", () => {
  it("reads the marker the stub module logs with", () => {
    const source = readFileSync("app/server/stub-auth.server.ts", "utf8");
    expect(readStubMarker(source)).toBe(MARKER);
    expect(source).toContain("[${STUB_AUTH_MARKER}]");
  });

  it("fails loudly when the marker is gone", () => {
    expect(() => readStubMarker("export {}")).toThrow(/STUB_AUTH_MARKER/);
  });
});

describe("inspectBuild", () => {
  it("passes a clean production build", () => {
    expect(inspect({})).toEqual([]);
  });

  it("passes a preview build that has the styleguide", () => {
    expect(inspect(STYLEGUIDE, "preview")).toEqual([]);
  });

  it("flags a stub auth chunk and the marker anywhere", () => {
    expect(
      inspect({
        "server/assets/stub-auth.server-x1.js": "export {}",
        "client/assets/entry-x2.js": `console.log("[${MARKER}]")`,
      })
    ).toEqual([
      "production: stub auth marker in client/assets/entry-x2.js",
      "production: stub auth chunk server/assets/stub-auth.server-x1.js",
    ]);
  });

  it("flags fixture hosts", () => {
    expect(
      inspect({ "server/assets/a.js": "fetch('http://127.0.0.1:4010/v1/me')" })
    ).toEqual([
      "production: fixture host 127.0.0.1:4010 in server/assets/a.js",
    ]);
  });

  it("flags the styleguide in production", () => {
    expect(inspect(STYLEGUIDE)).toEqual([
      "production: routes/styleguide present in the server build",
      "production: routes/styleguide present in the client manifest",
    ]);
  });

  it("flags a preview build missing the styleguide route", () => {
    expect(inspect({}, "preview")).toEqual([
      "preview: routes/styleguide missing from the server build",
      "preview: routes/styleguide missing from the client manifest",
    ]);
  });

  it("always expects the styleguide in preview, so a renamed route can't switch the check off", () => {
    expect(inspect({}, "preview")).toEqual([
      "preview: routes/styleguide missing from the server build",
      "preview: routes/styleguide missing from the client manifest",
    ]);
  });

  it("flags an empty or unrecognisable build", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bt-inspect-"));
    dirs.push(dir);
    expect(
      inspectBuild({
        buildDir: dir,
        mode: "production",
        marker: MARKER,
      })
    ).toEqual([
      "production: no server build",
      "production: expected one client manifest",
    ]);
  });
});

// The positive control: a real `vite build --mode e2e`, which has stub auth
// compiled in, must be caught. The fake directories above can't show that
// the marker survives bundling and minification as the scan expects. One
// build (about 10-15 s) for the whole file.
describe("inspectBuild on a real e2e build", () => {
  const BUILD_TIMEOUT = 180_000;
  let buildDir = "";

  beforeAll(async () => {
    buildDir = mkdtempSync(path.join(tmpdir(), "bt-e2e-build-"));
    // vite.config.ts leaves Remix out when it sees VITEST, and vitest's
    // NODE_ENV=test would change what Vite builds: the child gets the
    // environment `npm run build:e2e` would have.
    const {
      VITEST: _vitest,
      VITEST_MODE: _mode,
      VITEST_POOL_ID: _pool,
      VITEST_WORKER_ID: _worker,
      ...env
    } = process.env;
    await promisify(execFile)(
      path.resolve("node_modules/.bin/remix"),
      ["vite:build", "--mode", "e2e"],
      {
        env: {
          ...env,
          NODE_ENV: "production",
          REMIX_BUILD_DIRECTORY: buildDir,
        },
      }
    );
  }, BUILD_TIMEOUT);

  afterAll(() => {
    rmSync(buildDir, { recursive: true, force: true });
  });

  it("finds the stub auth marker, and only stub auth", () => {
    // e2e builds keep the styleguide, as preview builds do.
    const problems = inspectBuild({
      buildDir,
      mode: "preview",
      marker: readStubMarker(
        readFileSync("app/server/stub-auth.server.ts", "utf8")
      ),
    });
    expect(problems).toContainEqual(
      expect.stringMatching(/^preview: stub auth marker in server[\\/]/)
    );
    expect(
      problems.filter(
        problem => !/: stub auth (marker in|chunk) /.test(problem)
      )
    ).toEqual([]);
  });
});
