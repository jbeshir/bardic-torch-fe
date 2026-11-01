import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
