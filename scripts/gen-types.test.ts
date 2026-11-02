import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTypes, TYPES_FILE, writeTypes } from "./gen-types.mjs";

// Each case runs wrangler types (about 2 s) in a copy of the Worker's
// config, so the committed file is never touched while other tests read it.
const TIMEOUT = 60_000;
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function workerCopy(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bt-types-"));
  dirs.push(dir);
  copyFileSync("wrangler.jsonc", path.join(dir, "wrangler.jsonc"));
  mkdirSync(path.join(dir, "workers"));
  copyFileSync("workers/app.ts", path.join(dir, "workers", "app.ts"));
  return dir;
}

describe("gen-types", () => {
  it(
    "generates the committed worker-configuration.d.ts from wrangler.jsonc, formatted, without wrangler's eslint-disable or process.env types",
    { timeout: TIMEOUT },
    async () => {
      const dir = workerCopy();
      await writeTypes(dir);
      const generated = readFileSync(path.join(dir, TYPES_FILE), "utf8");
      expect(generated).toBe(readFileSync(TYPES_FILE, "utf8"));
      expect(generated).not.toContain("eslint-disable");
      expect(generated).not.toContain("ProcessEnv");
      expect(generated).toMatch(/^interface Env extends __BaseEnv_Env \{\}$/m);
      expect(await checkTypes(dir)).toEqual([]);
    }
  );

  it(
    "--check fails on a hand-edited file, and leaves it as it was",
    { timeout: TIMEOUT },
    async () => {
      const dir = workerCopy();
      await writeTypes(dir);
      const file = path.join(dir, TYPES_FILE);
      const edited = readFileSync(file, "utf8").replace(
        "AUTH_SESSION_SECRET: string;",
        "AUTH_SESSION_SECRET: string;\n  SENTRY_DSN: string;"
      );
      writeFileSync(file, edited);
      expect(await checkTypes(dir)).toEqual([
        `${TYPES_FILE} is not what wrangler.jsonc generates: run npm run gen:types (never edit it by hand)`,
      ]);
      expect(readFileSync(file, "utf8")).toBe(edited);
    }
  );
});
