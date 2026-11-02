import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * Replace `api/openapi.yaml` byte for byte with the backend's spec, then
 * regenerate the TypeScript types from it.
 */

const TARGET_PATH = fileURLToPath(
  new URL("../api/openapi.yaml", import.meta.url)
);

const USAGE = `Usage: npm run sync:api -- <path-or-url>

Copies the backend OpenAPI spec over api/openapi.yaml and runs gen:api.

Examples:
  npm run sync:api -- ../bardic-torch/openapi/api.yaml
  npm run sync:api -- https://raw.githubusercontent.com/jbeshir/bardic-torch/main/openapi/api.yaml`;

/** @param {string} source */
async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    let response;
    try {
      response = await fetch(source);
    } catch (error) {
      throw new Error(`Could not fetch ${source}: ${String(error)}`, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new Error(`Fetching ${source} failed with HTTP ${response.status}`);
    }
    return response.text();
  }
  try {
    return await readFile(resolve(source), "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : "";
    throw new Error(
      code === "ENOENT"
        ? `No such file: ${source}`
        : `Could not read ${source}: ${String(error)}`,
      { cause: error }
    );
  }
}

/**
 * @param {string} text
 * @param {string} source
 */
function assertOpenApi3Yaml(text, source) {
  let document;
  try {
    document = parse(text);
  } catch (error) {
    throw new Error(`${source} is not valid YAML: ${String(error)}`, {
      cause: error,
    });
  }
  const isObject = typeof document === "object" && document !== null;
  const version = isObject ? document.openapi : undefined;
  if (typeof version !== "string" || !/^3\.\d+\.\d+$/.test(version)) {
    throw new Error(`${source} is not an OpenAPI 3 document (no openapi: 3.x)`);
  }
  if (typeof document.paths !== "object" || document.paths === null) {
    throw new Error(`${source} is not an OpenAPI 3 document (no paths)`);
  }
}

/**
 * @param {string} source a file path or http(s) URL
 * @param {string} targetPath where to write the spec
 */
export async function syncApi(source, targetPath) {
  const text = await readSource(source);
  assertOpenApi3Yaml(text, source);
  await writeFile(targetPath, text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (!source) {
    console.error(USAGE);
    process.exit(1);
  }
  try {
    await syncApi(source, TARGET_PATH);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log(`Copied ${source} to api/openapi.yaml`);
  const result = spawnSync("npm", ["run", "gen:api"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
