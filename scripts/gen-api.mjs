import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import { format, resolveConfig } from "prettier";

/**
 * Generate `app/api/schema.gen.ts` from `api/openapi.yaml` with
 * openapi-typescript, formatted by Prettier.
 *
 * The `webhooks` and `$defs` aliases are dropped: the spec declares
 * neither, so they are `Record<string, never>` and nothing could use them.
 * Generation fails if the spec ever starts declaring them.
 *
 * `node scripts/gen-api.mjs --check` regenerates in memory and fails if the
 * committed file differs.
 */

const SPEC_URL = new URL("../api/openapi.yaml", import.meta.url);
const OUTPUT_PATH = fileURLToPath(
  new URL("../app/api/schema.gen.ts", import.meta.url)
);
const DROPPED_DECLARATIONS = new Set(["webhooks", "$defs"]);

/** @param {import("typescript").Node} node */
function declarationName(node) {
  return "name" in node && node.name && "text" in node.name
    ? String(node.name.text)
    : undefined;
}

async function generateSchemaTypes() {
  const nodes = await openapiTS(SPEC_URL);
  const kept = nodes.filter(node => {
    const name = declarationName(node);
    if (name === undefined || !DROPPED_DECLARATIONS.has(name)) return true;
    const text = astToString([node]);
    if (!text.includes("Record<string, never>")) {
      throw new Error(`${name} is no longer empty; stop dropping it`);
    }
    return false;
  });
  const source = COMMENT_HEADER + astToString(kept);
  const options = await resolveConfig(OUTPUT_PATH);
  return format(source, { ...options, filepath: OUTPUT_PATH });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = await generateSchemaTypes();
  if (process.argv.includes("--check")) {
    const committed = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
    if (committed !== generated) {
      console.error(
        "app/api/schema.gen.ts is stale; run `npm run gen:api` and commit it"
      );
      process.exit(1);
    }
    console.log("app/api/schema.gen.ts is up to date");
  } else {
    await writeFile(OUTPUT_PATH, generated);
    console.log("Wrote app/api/schema.gen.ts");
  }
}
