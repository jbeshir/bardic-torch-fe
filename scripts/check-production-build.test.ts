import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
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

  it.each(MARKDOWN_PARSER_MARKERS)(
    "finds the Markdown parser in a client chunk by %s, and allows it on the server",
    parser => {
      expect(
        inspect({
          "client/assets/notes-abc.js": `var t="${parser}";`,
          "server/assets/server-build.js": `var t="${parser}";`,
        })
      ).toEqual([
        "production: the Markdown parser (micromark) in client/assets/notes-abc.js",
      ]);
    }
  );

  it.each(ZOD_MARKERS)(
    "finds zod in a client chunk by %s, and allows it on the server",
    zod => {
      expect(
        inspect({
          "client/assets/catalogue-abc.js": `class e extends Error{name="${zod}"}`,
          "server/assets/server-build.js": `var t="${zod}";`,
        })
      ).toEqual(["production: zod in client/assets/catalogue-abc.js"]);
    }
  );

  it("passes a preview build that has noindex", () => {
    expect(
      inspect(
        {
          "server/index.js": `const routes = { "routes/_index": {} }; ${NOINDEX}`,
        },
        "preview"
      )
    ).toEqual([]);
  });

  it("flags a production build that would be indexed without its rules, or sends noindex", () => {
    expect(
      inspect({ "server/index.js": 'const routes = { "routes/_index": {} };' })
    ).toEqual([
      "production: the crawlable robots.txt rules are missing from the server build",
    ]);
    expect(
      inspect({
        "server/index.js": `${INDEXABLE_RULES}${NOINDEX}`,
      })
    ).toEqual(["production: X-Robots-Tag is present in the server build"]);
  });

  it("reads the code, not the source maps that hold the text of every source", () => {
    expect(
      inspect(
        {
          "server/index.js": `const routes = { "routes/_index": {} }; ${NOINDEX}`,
          "server/index.js.map": `{"sourcesContent":["${INDEXABLE_ONLY_MARKER}"]}`,
        },
        "preview"
      )
    ).toEqual([]);
  });

  it("flags a preview build that is crawlable or lacks the noindex header", () => {
    expect(
      inspect(
        {
          "server/index.js": `const routes = { "routes/_index": {} }; ${INDEXABLE_RULES}`,
        },
        "preview"
      )
    ).toEqual([
      "preview: the crawlable robots.txt rules are present in the server build",
      "preview: X-Robots-Tag is missing from the server build",
    ]);
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

  it("flags local variables in the build: a .dev.vars copy, AUTH_MODE as a variable, dev:fixtures values", () => {
    expect(
      inspect({
        "server/.dev.vars": "AUTH_SESSION_SECRET=local",
        "server/wrangler.json": JSON.stringify({
          name: "bardic-torch-fe",
          vars: { AUTH_MODE: "stub" },
        }),
        "server/assets/b.js":
          'const secret = "dev-fixtures-session-secret-not-for-real-use";',
      })
    ).toEqual([
      "production: local variables copied into server/.dev.vars",
      "production: dev:fixtures value dev-fixtures-session-secret-not-for-real-use in server/assets/b.js",
      "production: dev:fixtures value dev-fixtures in server/assets/b.js",
      "production: AUTH_MODE is a variable of the built Worker",
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
    ).toEqual(["production: no server build"]);
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

  it("parses Markdown and checks answers on the server, so the client checks look for something real", () => {
    const server = readdirSync(path.join(buildDir, "server"), {
      recursive: true,
      encoding: "utf8",
    })
      .filter(name => name.endsWith(".js"))
      .map(name => readFileSync(path.join(buildDir, "server", name), "utf8"))
      .join("\n");
    for (const parser of MARKDOWN_PARSER_MARKERS.slice(1)) {
      expect(server).toContain(parser);
    }
    // The markers find zod where it is, so its absence from the client
    // (no problem above) means something.
    for (const zod of ZOD_MARKERS) expect(server).toContain(zod);
  });
});
