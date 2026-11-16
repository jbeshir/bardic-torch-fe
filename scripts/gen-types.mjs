import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

/**
 * `npm run gen:types` writes worker-configuration.d.ts, the Worker's `Env`
 * (and the preview Worker's `PreviewEnv`) from wrangler.jsonc's `vars` and
 * `secrets.required`, with `wrangler types --include-runtime=false`; the
 * runtime types come from @cloudflare/workers-types. The file is committed,
 * formatted and linted like any source file, so wrangler's leading
 * `/* eslint-disable *\/` line is dropped and prettier formats the rest.
 *
 * Wrangler also types `process.env` as always holding the Worker's
 * variables (`nodejs_compat` populates it in the Worker). That block is
 * dropped too: the Worker reads its variables from `env` (env.server.ts),
 * and everywhere `process.env` is read (Node: the scripts, the configs, the
 * tests) they are usually unset, so the type would be wrong there.
 *
 * `npm run check:types` (`--check`) regenerates it, restores the committed
 * file, and fails unless the two are byte-identical: a stale or
 * hand-edited `Env`. (`wrangler types --check` compares only a hash in the
 * header, so it would pass a hand edit.)
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const TYPES_FILE = "worker-configuration.d.ts";

/** Wrangler's `process.env` augmentation and its helper type. */
const PROCESS_ENV_TYPES =
  /\ntype StringifyValues<[^\n]*\n(?:\t[^\n]*\n)*\};\ndeclare namespace NodeJS \{\n\tinterface ProcessEnv [^\n]*\n\}/;

/**
 * The generated file for the wrangler.jsonc in `dir`, as committed. Wrangler
 * writes it to `dir` (replacing any file there: wrangler refuses to replace
 * one it didn't write), and the caller writes the returned text.
 * @param {string} dir
 * @returns {Promise<string>}
 */
async function generate(dir) {
  rmSync(path.join(dir, TYPES_FILE), { force: true });
  const result = spawnSync(
    path.join(ROOT, "node_modules/.bin/wrangler"),
    ["types", "--include-runtime=false"],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    }
  );
  if (result.status !== 0) {
    throw new Error(`wrangler types failed:\n${result.stdout}${result.stderr}`);
  }
  const generated = readFileSync(path.join(dir, TYPES_FILE), "utf8");
  const [first, ...rest] = generated.split("\n");
  if (first !== "/* eslint-disable */") {
    throw new Error(`Unexpected first line from wrangler types: ${first}`);
  }
  const types = rest.join("\n").replace(PROCESS_ENV_TYPES, "");
  const file = path.join(ROOT, TYPES_FILE);
  const options = await resolveConfig(file);
  return format(types, { ...options, filepath: file });
}

/**
 * Write the types file for the wrangler.jsonc in `dir`.
 * @param {string} dir
 */
export async function writeTypes(dir) {
  writeFileSync(path.join(dir, TYPES_FILE), await generate(dir));
}

/**
 * Problems with the committed types file in `dir` (empty when it is what
 * gen:types writes), leaving the file as it was.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function checkTypes(dir) {
  const file = path.join(dir, TYPES_FILE);
  if (!existsSync(file))
    return [`${TYPES_FILE} is missing: run npm run gen:types`];
  const committed = readFileSync(file, "utf8");
  let generated;
  try {
    generated = await generate(dir);
  } finally {
    rmSync(file, { force: true });
    writeFileSync(file, committed);
  }
  return generated === committed
    ? []
    : [
        `${TYPES_FILE} is not what wrangler.jsonc generates: run npm run gen:types (never edit it by hand)`,
      ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--check")) {
      const problems = await checkTypes(ROOT);
      if (problems.length > 0) {
        console.error(`check:types failed:\n${problems.join("\n")}`);
        process.exitCode = 1;
      } else {
        console.log(`check:types: ${TYPES_FILE} is up to date`);
      }
    } else {
      await writeTypes(ROOT);
      console.log(`gen:types: wrote ${TYPES_FILE}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
