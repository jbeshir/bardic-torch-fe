import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { build } from "./build.mjs";
import {
  DEPLOY_CONFIG,
  INDEXABLE_ONLY_MARKER,
  inspectBuild,
  MARKDOWN_PARSER_MARKERS,
  readStubMarker,
  withDeployConfigRestored,
  ZOD_MARKERS,
} from "./check-production-build.mjs";

const MARKER = "bardic-torch-stub-auth";
const dirs: string[] = [];

/** What a production server build has of the robots rules. */
const INDEXABLE_RULES = `var rules="${INDEXABLE_ONLY_MARKER}";`;
/** What a preview server build has instead. */
const NOINDEX = 'var header="X-Robots-Tag";';

/** A fake build output directory with the given files. */
function fakeBuild(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bt-inspect-"));
  dirs.push(dir);
  const all = {
    "server/index.js": `const routes = { "routes/_index": {} }; ${INDEXABLE_RULES}`,
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

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

const ROUTES = 'const routes = { "routes/_index": {} };';

describe("inspectBuild", () => {
  it.each([
    ["passes a clean production build", "production", {}, []],
    [
      "passes a preview build that has noindex",
      "preview",
      { "server/index.js": `${ROUTES} ${NOINDEX}` },
      [],
    ],
    [
      "reads the code, not source maps",
      "preview",
      {
        "server/index.js": `${ROUTES} ${NOINDEX}`,
        "server/index.js.map": `{"sourcesContent":["${INDEXABLE_ONLY_MARKER}"]}`,
      },
      [],
    ],
    [
      "flags the Markdown parser in a client chunk only",
      "production",
      {
        "client/assets/notes-abc.js": `var t="${MARKDOWN_PARSER_MARKERS[0]}";`,
        "server/assets/server-build.js": `var t="${MARKDOWN_PARSER_MARKERS[0]}";`,
      },
      [
        "production: the Markdown parser (micromark) in client/assets/notes-abc.js",
      ],
    ],
    [
      "flags zod in a client chunk only",
      "production",
      {
        "client/assets/catalogue-abc.js": `var t="${ZOD_MARKERS[0]}";`,
        "server/assets/server-build.js": `var t="${ZOD_MARKERS[0]}";`,
      },
      ["production: zod in client/assets/catalogue-abc.js"],
    ],
    [
      "flags a production build without crawlable rules, or with noindex",
      "production",
      { "server/index.js": `${INDEXABLE_RULES}${NOINDEX}` },
      ["production: X-Robots-Tag is present in the server build"],
    ],
    [
      "flags a preview build that is crawlable or lacks noindex",
      "preview",
      { "server/index.js": `${ROUTES} ${INDEXABLE_RULES}` },
      [
        "preview: the crawlable robots.txt rules are present in the server build",
        "preview: X-Robots-Tag is missing from the server build",
      ],
    ],
    [
      "flags a stub auth chunk and the marker",
      "production",
      {
        "server/assets/stub-auth.server-x1.js": "export {}",
        "client/assets/entry-x2.js": `console.log("[${MARKER}]")`,
      },
      [
        "production: stub auth marker in client/assets/entry-x2.js",
        "production: stub auth chunk server/assets/stub-auth.server-x1.js",
      ],
    ],
    [
      "flags fixture hosts",
      "production",
      { "server/assets/a.js": "fetch('http://127.0.0.1:4010/v1/me')" },
      ["production: fixture host 127.0.0.1:4010 in server/assets/a.js"],
    ],
    [
      "flags AUTH_MODE as a variable of the built Worker",
      "production",
      {
        "server/wrangler.json": JSON.stringify({ vars: { AUTH_MODE: "stub" } }),
      },
      ["production: AUTH_MODE is a variable of the built Worker"],
    ],
  ] as const)("%s", (_name, mode, files, expected) => {
    expect(inspect(files, mode)).toEqual(expected);
  });
});

describe("withDeployConfigRestored", () => {
  function fakeRoot(config: string | null) {
    const root = mkdtempSync(path.join(tmpdir(), "bt-root-"));
    dirs.push(root);
    if (config !== null) {
      mkdirSync(path.dirname(path.join(root, DEPLOY_CONFIG)), {
        recursive: true,
      });
      writeFileSync(path.join(root, DEPLOY_CONFIG), config);
    }
    return root;
  }
  /** What a build in a temporary directory writes there. */
  function redirect(root: string) {
    mkdirSync(path.dirname(path.join(root, DEPLOY_CONFIG)), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, DEPLOY_CONFIG),
      '{"configPath":"../../../tmp/bt-prod-build-x/server/wrangler.json"}'
    );
  }
  const ORIGINAL = '{"configPath":"../../build/server/wrangler.json"}\n';

  it("puts the deploy config back byte for byte after a passing run, or removes one that wasn't there", () => {
    const root = fakeRoot(ORIGINAL);
    expect(
      withDeployConfigRestored(root, () => (redirect(root), "built"))
    ).toBe("built");
    expect(readFileSync(path.join(root, DEPLOY_CONFIG), "utf8")).toBe(ORIGINAL);

    const bare = fakeRoot(null);
    withDeployConfigRestored(bare, () => redirect(bare));
    expect(() => readFileSync(path.join(bare, DEPLOY_CONFIG))).toThrow(
      /ENOENT/
    );
  });

  it("puts the deploy config back after a failing run too", () => {
    const root = fakeRoot(ORIGINAL);
    expect(() =>
      withDeployConfigRestored(root, () => {
        redirect(root);
        throw new Error("the build failed");
      })
    ).toThrow("the build failed");
    expect(readFileSync(path.join(root, DEPLOY_CONFIG), "utf8")).toBe(ORIGINAL);
  });
});

// The positive control: a real `react-router build --mode e2e`, which has stub auth
// compiled in, must be caught. The fake directories above can't show that
// the marker survives bundling and minification as the scan expects. One
// build (about 10-15 s) for the whole file.
describe("inspectBuild on a real e2e build", () => {
  const BUILD_TIMEOUT = 180_000;
  let buildDir = "";

  beforeAll(async () => {
    buildDir = mkdtempSync(path.join(tmpdir(), "bt-e2e-build-"));
    // Vitest's NODE_ENV=test would change what Vite builds: the child gets
    // the environment `npm run build:e2e` would have.
    const {
      VITEST: _vitest,
      VITEST_MODE: _mode,
      VITEST_POOL_ID: _pool,
      VITEST_WORKER_ID: _worker,
      ...env
    } = process.env;
    const problems = withDeployConfigRestored(process.cwd(), () =>
      build("e2e", {
        buildDir,
        env: { ...env, NODE_ENV: "production" },
        stdio: "pipe",
      })
    );
    expect(problems).toEqual([]);
  }, BUILD_TIMEOUT);

  afterAll(() => {
    rmSync(buildDir, { recursive: true, force: true });
  });

  it("finds the stub auth marker, and only stub auth", () => {
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
