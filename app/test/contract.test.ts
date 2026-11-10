import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contractMisuse } from "./contract";

const ME = {
  id: "google-oauth2|1",
  display_name: "Morwen",
  role: "contributor",
};

describe("contractMisuse", () => {
  it("accepts a declared answer the contract allows", () => {
    expect(contractMisuse("declared", "getMe", 200, ME)).toBeUndefined();
  });

  it.each([
    ["a body breaking its schema", "getMe", 200, { ...ME, role: "admin" }],
    [
      "an undeclared status",
      "getMe",
      503,
      { code: "unavailable", message: "x" },
    ],
  ] as const)(
    "flags a declared answer with %s",
    (_label, operation, status, body) => {
      expect(contractMisuse("declared", operation, status, body)).toMatch(
        `${operation} ${status} is not what api/openapi.yaml declares`
      );
    }
  );

  it("flags an off-contract answer that the contract allows", () => {
    expect(contractMisuse("off-contract", "getMe", 200, ME)).toBe(
      "getMe 200 is marked off-contract but api/openapi.yaml allows it"
    );
    expect(
      contractMisuse("off-contract", "getMe", 200, { ...ME, role: "admin" })
    ).toBeUndefined();
  });
});

/** Every test file under app/ but this one, which names the call it bans. */
function appTestFiles(): string[] {
  return readdirSync("app", { recursive: true, encoding: "utf8" })
    .filter(file => /\.test\.tsx?$/.test(file))
    .map(file => path.join("app", file))
    .filter(file => file !== path.join("app", "test", "contract.test.ts"))
    .sort();
}

describe("msw answers in app tests", () => {
  it("send every API body through contractResponse or offContractResponse", () => {
    // Raw JSON answers are only for Auth0, whose endpoints are not in
    // api/openapi.yaml: the handler is named on one of the lines before.
    const raw = appTestFiles().flatMap(file => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.flatMap((line, index) => {
        if (!line.includes("HttpResponse.json(")) return [];
        const before = lines
          .slice(Math.max(0, index - 3), index + 1)
          .join("\n");
        return /auth0/i.test(before) ? [] : [`${file}:${index + 1}`];
      });
    });
    expect(raw).toEqual([]);
  });

  it("scans the tests that answer for the API", () => {
    expect(appTestFiles()).toEqual(
      expect.arrayContaining([
        "app/server/api.server.test.ts",
        "app/routes/api.me.test.ts",
      ])
    );
  });
});
