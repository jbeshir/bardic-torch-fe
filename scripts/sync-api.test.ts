import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { syncApi } from "./sync-api.mjs";

const SPEC = `openapi: 3.1.0
info:
  title: Backend
  version: 1.0.0
paths: {}
`;

const routes: Record<string, { status: number; body: string }> = {
  "/api.yaml": { status: 200, body: SPEC },
  "/missing.yaml": { status: 404, body: "Not Found" },
  "/page.html": { status: 200, body: "<html><body>Not YAML: [</body></html>" },
};

let server: Server;
let baseUrl: string;
let directory: string;
let target: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const route = routes[request.url ?? ""] ?? { status: 404, body: "" };
    response.writeHead(route.status).end(route.body);
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(done => server.close(done));
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "sync-api-"));
  target = join(directory, "openapi.yaml");
  await writeFile(target, "previous contents");
});

describe("sync:api CLI", () => {
  it("prints usage with the default URL and sibling path when given no source", () => {
    const result = spawnSync(process.execPath, ["scripts/sync-api.mjs"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: npm run sync:api -- <path-or-url>");
    expect(result.stderr).toContain(
      "https://raw.githubusercontent.com/jbeshir/bardic-torch/main/openapi/api.yaml"
    );
    expect(result.stderr).toContain("../bardic-torch/openapi/api.yaml");
  });

  it("exits non-zero with a clear message for a missing file", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/sync-api.mjs", "does/not/exist.yaml"],
      { encoding: "utf8" }
    );
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("No such file: does/not/exist.yaml");
  });
});

describe("syncApi", () => {
  it("copies a local spec byte for byte", async () => {
    const source = join(directory, "source.yaml");
    const bytes = `${SPEC}# trailing comment kept\n`;
    await writeFile(source, bytes);
    await syncApi(source, target);
    expect(await readFile(target, "utf8")).toBe(bytes);
  });

  it("copies a spec served over HTTP", async () => {
    await syncApi(`${baseUrl}/api.yaml`, target);
    expect(await readFile(target, "utf8")).toBe(SPEC);
  });

  it("fails on an HTTP error and leaves the target untouched", async () => {
    await expect(syncApi(`${baseUrl}/missing.yaml`, target)).rejects.toThrow(
      `Fetching ${baseUrl}/missing.yaml failed with HTTP 404`
    );
    expect(await readFile(target, "utf8")).toBe("previous contents");
  });

  it("fails on a document that is not YAML", async () => {
    await expect(syncApi(`${baseUrl}/page.html`, target)).rejects.toThrow(
      /is not (valid YAML|an OpenAPI 3 document)/
    );
    expect(await readFile(target, "utf8")).toBe("previous contents");
  });

  it.each([
    ["a Swagger 2 document", "swagger: '2.0'\npaths: {}\n"],
    ["a YAML list", "- openapi\n- 3.1.0\n"],
    ["a spec without paths", "openapi: 3.1.0\ninfo: {}\n"],
    ["a scalar", "just text\n"],
  ])("rejects %s", async (_label, contents) => {
    const source = join(directory, "source.yaml");
    await writeFile(source, contents);
    await expect(syncApi(source, target)).rejects.toThrow(
      `${source} is not an OpenAPI 3 document`
    );
    expect(await readFile(target, "utf8")).toBe("previous contents");
  });

  it("rejects malformed YAML", async () => {
    const source = join(directory, "source.yaml");
    await writeFile(source, "openapi: [3.1.0\n");
    await expect(syncApi(source, target)).rejects.toThrow(
      `${source} is not valid YAML`
    );
  });
});
