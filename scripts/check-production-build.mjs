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

/**
 * `npm run check:prod-build`: build the `production` and `preview` modes into
 * temporary directories (leaving `build/` alone) with scripts/build.mjs, and
 * fail if either contains stub auth (its chunk or its marker string).
 *
 * Building rewrites .wrangler/deploy/config.json, which points `wrangler
 * dev` and `wrangler deploy` at a build; it is put back as it was.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STUB_SOURCE = path.join(ROOT, "app/server/stub-auth.server.ts");
export const DEPLOY_CONFIG = ".wrangler/deploy/config.json";

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
 * Stub auth in one build output directory (`client/` + `server/`), as
 * human-readable lines; empty when the build is clean.
 *
 * @param {{ buildDir: string, mode: "production" | "preview", marker: string }} options
 */
export function inspectBuild({ buildDir, mode, marker }) {
  const problems = [];
  for (const file of listFiles(buildDir)) {
    const name = path.relative(buildDir, file);
    if (/stub-auth/i.test(path.basename(name))) {
      problems.push(`${mode}: stub auth chunk ${name}`);
    }
    if (readFileSync(file, "utf8").includes(marker)) {
      problems.push(`${mode}: stub auth marker in ${name}`);
    }
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
        "check:prod-build: production and preview builds have no stub auth"
      );
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
