import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseConfigFileTextToJson } from "typescript";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Set with `wrangler secret put` per Worker, never in the repo. */
const SECRET_NAMES = [
  "AUTH_SESSION_SECRET",
  "AUTH0_CLIENT_SECRET",
  "SENTRY_DSN",
];

describe("repo hygiene", () => {
  it("every dependency pinned exactly", () => {
    const { dependencies, devDependencies } = JSON.parse(
      read("package.json")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const exact = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
    const inexact = Object.entries({ ...dependencies, ...devDependencies })
      .filter(([, version]) => !exact.test(version))
      .map(([name]) => name);
    expect(inexact).toEqual([]);
  });

  it("names no secret value anywhere, and never sets AUTH_MODE", () => {
    const source = read("wrangler.jsonc");
    const config = parseConfigFileTextToJson("wrangler.jsonc", source)
      .config as {
      vars?: object;
      observability?: object;
      env?: { preview?: { vars?: object; observability?: object } };
    };
    const vars = [config.vars, config.env?.preview?.vars].flatMap(v =>
      Object.keys(v ?? {})
    );
    expect(vars.filter(name => SECRET_NAMES.includes(name))).toEqual([]);
    // A secret's name is only ever listed as required, never given a value.
    const assigned = [...source.matchAll(/"([A-Z0-9_]+)"\s*:/g)].filter(
      ([, name]) => SECRET_NAMES.includes(name!)
    );
    expect(assigned).toEqual([]);
    expect(source).not.toContain("AUTH_MODE");
    // A query string can carry a one-time secret (/auth/callback?code=…).
    const logging = {
      enabled: true,
      redact_query_string: true,
      logs: { invocation_logs: false },
    };
    expect(config.observability).toEqual(logging);
    expect(config.env?.preview?.observability).toEqual(logging);
  });

  it(".dev.vars.example holds placeholders only", () => {
    const values = new Map(
      [
        ...read(".dev.vars.example").matchAll(/^(?:# )?([A-Z0-9_]+)=(.*)$/gm),
      ].map(([, name, value]) => [name, value])
    );
    for (const name of [...SECRET_NAMES, "AUTH0_CLIENT_ID"])
      expect(values.get(name)).toMatch(/replace-with/);
  });

  it(".dev.vars is gitignored", () => {
    expect(read(".gitignore").split("\n")).toContain(".dev.vars");
  });

  it("CI needs no secrets", () => {
    for (const file of ["ci.yml", "audit.yml"])
      expect(read(`.github/workflows/${file}`)).not.toMatch(/secrets\./);
  });
});
