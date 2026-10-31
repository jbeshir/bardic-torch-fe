import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run check:prod-build`: build the `production` and `preview` modes into
 * temporary directories (leaving `build/` alone) and fail unless neither
 * contains stub auth or fixture hosts, and `/styleguide` is excluded from
 * production but, when the route exists, present in preview.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STUB_SOURCE = path.join(ROOT, "app/server/stub-auth.server.ts");
const FIXTURE_HOSTS = ["fixture.invalid", "127.0.0.1:4010"];
const STYLEGUIDE_ROUTE_ID = "routes/styleguide";

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
 * @param {{ buildDir: string, mode: "production" | "preview", marker: string, styleguideExists: boolean }} options
 */
export function inspectBuild({ buildDir, mode, marker, styleguideExists }) {
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
  }

  const server = files.filter(({ name }) => name.startsWith("server"));
  const manifests = files.filter(({ name }) =>
    /^client[\\/]assets[\\/]manifest-[^\\/]+\.js$/.test(name)
  );
  if (server.length === 0) problems.push(`${mode}: no server build`);
  if (manifests.length !== 1) {
    problems.push(`${mode}: expected one client manifest`);
  }
  const has = list =>
    list.some(({ content }) => content.includes(`"${STYLEGUIDE_ROUTE_ID}"`));
  const wanted = mode === "preview" && styleguideExists;
  for (const [where, list] of [
    ["server build", server],
    ["client manifest", manifests],
  ]) {
    if (has(list) !== wanted) {
      problems.push(
        `${mode}: ${STYLEGUIDE_ROUTE_ID} ${wanted ? "missing from" : "present in"} the ${where}`
      );
    }
  }
  return problems;
}

function build(mode, buildDir) {
  const result = spawnSync(
    path.join(ROOT, "node_modules/.bin/remix"),
    ["vite:build", "--mode", mode],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, REMIX_BUILD_DIRECTORY: buildDir },
    }
  );
  if (result.status !== 0) {
    throw new Error(`${mode} build failed:\n${result.stdout}${result.stderr}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const marker = readStubMarker(readFileSync(STUB_SOURCE, "utf8"));
  const styleguideExists = readdirSync(path.join(ROOT, "app/routes")).some(
    name => name.startsWith("styleguide") && !name.includes(".test.")
  );
  const tempDir = mkdtempSync(path.join(tmpdir(), "bt-prod-build-"));
  try {
    const problems = ["production", "preview"].flatMap(mode => {
      const buildDir = path.join(tempDir, mode);
      build(mode, buildDir);
      return inspectBuild({ buildDir, mode, marker, styleguideExists });
    });
    if (problems.length > 0) {
      console.error(`check:prod-build failed:\n${problems.join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(
        "check:prod-build: production and preview builds are free of stub auth and fixture hosts; " +
          `${STYLEGUIDE_ROUTE_ID} is ${styleguideExists ? "only in preview" : "not in either (no route yet)"}`
      );
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
