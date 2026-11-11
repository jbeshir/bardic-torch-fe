import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";
import { fixtureAppEnv } from "./dev-fixtures.mjs";

/**
 * `npm run check:prod-build`: build the `production` and `preview` modes into
 * temporary directories (leaving `build/` alone) with scripts/build.mjs, and
 * fail unless:
 * - neither contains stub auth, fixture hosts or any of `npm run
 *   dev:fixtures`' values;
 * - each deploys to its own Worker (bardic-torch-fe, bardic-torch-fe-preview);
 * - neither carries a `.dev.vars` copy or an AUTH_MODE variable;
 * - neither's client build has the Markdown parser (micromark), which runs
 *   in loaders only, or zod, which checks form input on the server only
 *   (the browser reads enum values from `app/constants/enums.ts`);
 * - `__INDEXABLE__` is true in production only: its server build has the
 *   crawlable robots.txt rules and no X-Robots-Tag, and the preview build
 *   has the opposite.
 *
 * Building rewrites .wrangler/deploy/config.json, which points `wrangler
 * dev` and `wrangler deploy` at a build; it is put back as it was.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STUB_SOURCE = path.join(ROOT, "app/server/stub-auth.server.ts");
const FIXTURE_HOSTS = ["fixture.invalid", "127.0.0.1:4010"];
/**
 * Strings that survive in a server build only for the `__INDEXABLE__` value
 * they are under (app/server/indexing.server.ts and
 * security-headers.server.ts): the crawlable robots.txt rules, and the
 * noindex header.
 */
export const INDEXABLE_ONLY_MARKER = "Disallow: /auth/";
const NOT_INDEXABLE_ONLY_MARKER = "X-Robots-Tag";
export const DEPLOY_CONFIG = ".wrangler/deploy/config.json";

/**
 * `npm run dev:fixtures`' variable values (default ports): never in a build.
 * Its AUTH_MODE (`stub`, a word the app's code has) is checked as a
 * variable of the built Worker instead, and its fixture API URL as a
 * fixture host.
 */
const DEV_VALUES = [
  ...new Set(
    Object.entries(fixtureAppEnv("5173", "4010"))
      .filter(([name]) => name !== "AUTH_MODE")
      .map(([, value]) => value)
  ),
].filter(value => !FIXTURE_HOSTS.some(host => value.includes(host)));

/**
 * Strings micromark's code keeps when minified (the client build drops its
 * name with the comments; its token types are string literals), so a
 * client chunk that has any of them has the Markdown parser.
 */
export const MARKDOWN_PARSER_MARKERS = [
  "micromark",
  "codeFencedFenceSequence",
  "characterReferenceMarkerHexadecimal",
];

/**
 * Strings zod's code keeps when minified (its classes are named by string
 * literals), so a client chunk that has one has zod, and with it the
 * response schemas that import it.
 */
export const ZOD_MARKERS = ["ZodError"];

/** The marker string stub-auth.server.ts puts into every build it is in. */
export function readStubMarker(source) {
  const marker = /const STUB_AUTH_MARKER = "([^"]+)"/.exec(source)?.[1];
  if (!marker) throw new Error("STUB_AUTH_MARKER not found in stub source");
  return marker;
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(entry.parentPath ?? entry.path, entry.name))
    .sort();
}

/**
 * Problems with one build output directory (`client/` + `server/`), as
 * human-readable lines; empty when the build is clean.
 *
 * @param {{ buildDir: string, mode: "production" | "preview", marker: string }} options
 */
export function inspectBuild({ buildDir, mode, marker }) {
  const problems = [];
  const files = listFiles(buildDir).map(file => ({
    name: path.relative(buildDir, file),
    content: readFileSync(file, "utf8"),
  }));

  for (const { name, content } of files) {
    if (/stub-auth/i.test(path.basename(name))) {
      problems.push(`${mode}: stub auth chunk ${name}`);
    }
    if (content.includes(marker)) {
      problems.push(`${mode}: stub auth marker in ${name}`);
    }
    for (const host of FIXTURE_HOSTS) {
      if (content.includes(host)) {
        problems.push(`${mode}: fixture host ${host} in ${name}`);
      }
    }
    for (const value of DEV_VALUES) {
      if (content.includes(value)) {
        problems.push(`${mode}: dev:fixtures value ${value} in ${name}`);
      }
    }
    if (
      name.startsWith("client") &&
      MARKDOWN_PARSER_MARKERS.some(parser => content.includes(parser))
    ) {
      problems.push(`${mode}: the Markdown parser (micromark) in ${name}`);
    }
    if (
      name.startsWith("client") &&
      ZOD_MARKERS.some(zod => content.includes(zod))
    ) {
      problems.push(`${mode}: zod in ${name}`);
    }
    if (path.basename(name) === ".dev.vars") {
      problems.push(`${mode}: local variables copied into ${name}`);
    }
  }

  const config = files.find(({ name }) =>
    /^server[\\/]wrangler\.json$/.test(name)
  );
  if (config && "AUTH_MODE" in (JSON.parse(config.content).vars ?? {})) {
    problems.push(`${mode}: AUTH_MODE is a variable of the built Worker`);
  }

  const server = files.filter(({ name }) => name.startsWith("server"));
  if (server.length === 0) problems.push(`${mode}: no server build`);
  // The code, not its source maps, which hold every source file's text.
  const serverSource = server
    .filter(({ name }) => /\.m?js$/.test(name))
    .map(({ content }) => content)
    .join("\n");
  const indexable = mode === "production";
  if (
    server.length > 0 &&
    serverSource.includes(INDEXABLE_ONLY_MARKER) !== indexable
  ) {
    problems.push(
      `${mode}: the crawlable robots.txt rules are ${indexable ? "missing from" : "present in"} the server build`
    );
  }
  if (
    server.length > 0 &&
    serverSource.includes(NOT_INDEXABLE_ONLY_MARKER) === indexable
  ) {
    problems.push(
      `${mode}: X-Robots-Tag is ${indexable ? "present in" : "missing from"} the server build`
    );
  }
  return problems;
}

/**
 * Run `task` and then put `root`'s .wrangler/deploy/config.json back byte
 * for byte (or remove it if there was none), whether `task` succeeded or
 * threw.
 * @template T
 * @param {string} root
 * @param {() => T} task
 * @returns {T}
 */
export function withDeployConfigRestored(root, task) {
  const file = path.join(root, DEPLOY_CONFIG);
  const saved = existsSync(file) ? readFileSync(file) : null;
  try {
    return task();
  } finally {
    if (saved === null) rmSync(file, { force: true });
    else writeFileSync(file, saved);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const marker = readStubMarker(readFileSync(STUB_SOURCE, "utf8"));
  const tempDir = mkdtempSync(path.join(tmpdir(), "bt-prod-build-"));
  try {
    const problems = withDeployConfigRestored(ROOT, () =>
      ["production", "preview"].flatMap(mode => {
        const buildDir = path.join(tempDir, mode);
        const built = build(mode, { buildDir, stdio: "pipe" });
        if (!existsSync(path.join(buildDir, "server"))) return built;
        return [...built, ...inspectBuild({ buildDir, mode, marker })];
      })
    );
    if (problems.length > 0) {
      console.error(`check:prod-build failed:\n${problems.join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(
        "check:prod-build: production and preview builds are free of stub auth, fixture hosts and local variables, " +
          `keep the Markdown parser out of the browser, deploy to their own Workers`
      );
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
