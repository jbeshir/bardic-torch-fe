import { spawn } from "node:child_process";
import type { Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFixtureServer } from "../fixture-api/server";
import { responseProblems } from "../fixture-api/spec";
import { INVALID_REQUESTS } from "./requests";
import { bearer, json, runScenario, SCENARIOS, type Send } from "./scenarios";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createFixtureServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(done => server.close(done));
});

const contentTypes: (string | null)[] = [];

const httpSend: Send = async request => {
  const response = await fetch(`${baseUrl}${request.path}`, {
    method: request.method,
    headers: {
      ...(request.authorization
        ? { Authorization: request.authorization }
        : {}),
      ...(request.contentType ? { "Content-Type": request.contentType } : {}),
    },
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const text = await response.text();
  contentTypes.push(text === "" ? null : response.headers.get("Content-Type"));
  return {
    status: response.status,
    body: text === "" ? undefined : (JSON.parse(text) as unknown),
  };
};

describe("fixture server", () => {
  it.each(
    SCENARIOS.map(
      scenario =>
        [`${scenario.operationId} ${scenario.name}`, scenario] as const
    )
  )("%s answers over HTTP as the spec says", async (_name, scenario) => {
    contentTypes.length = 0;
    const response = await runScenario(scenario, httpSend);
    expect(response.status).toBe(scenario.status);
    expect(
      responseProblems(scenario.operationId, response.status, response.body)
    ).toEqual([]);
    const last = contentTypes.at(-1);
    expect(last === null || last === "application/json").toBe(true);
  });

  it("serves the seeded contributor to the stub session's bearer", async () => {
    const response = await httpSend({
      method: "GET",
      path: "/v1/me",
      authorization: bearer("contributor"),
    });
    expect(response).toMatchObject({
      status: 200,
      body: { display_name: "Morwen of the Marches" },
    });
  });

  it("keeps state across requests to one server", async () => {
    const { body } = await httpSend({
      method: "POST",
      path: "/__fixtures/users",
      ...json({}),
    });
    const { id } = body as { id: string };
    await httpSend({
      method: "PATCH",
      path: "/v1/me",
      authorization: bearer(id),
      ...json({ display_name: "Only me" }),
    });
    expect(
      (
        await httpSend({
          method: "GET",
          path: "/v1/me",
          authorization: bearer(id),
        })
      ).body
    ).toMatchObject({ display_name: "Only me" });
  });

  it("refuses to read bodies over 64 KiB", async () => {
    const response = await httpSend({
      method: "PATCH",
      path: "/v1/me",
      authorization: bearer("contributor"),
      ...json({ display_name: "x".repeat(70_000) }),
    });
    expect(response).toEqual({
      status: 413,
      body: { code: "request_too_large", message: "request body is too large" },
    });
  });

  it("answers 500 and logs when a fixture would break the spec", async () => {
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const broken = createFixtureServer();
    await new Promise<void>(done => broken.listen(0, "127.0.0.1", done));
    const port = (broken.address() as AddressInfo).port;
    try {
      // The control endpoint takes any display name, so a 65-character one
      // makes getMe answer with a User the spec forbids.
      await fetch(`http://127.0.0.1:${port}/__fixtures/users`, {
        method: "POST",
        body: JSON.stringify({ display_name: "x".repeat(65) }),
      });
      const response = await fetch(`http://127.0.0.1:${port}/v1/me`, {
        headers: { Authorization: bearer("user-1") },
      });
      expect(response.status).toBe(500);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      await new Promise(done => broken.close(done));
      consoleError.mockRestore();
    }
  });
});

describe("fixture server catalogue requests", () => {
  it.each(INVALID_REQUESTS.map(request => [request.name, request] as const))(
    "answers 400 over HTTP to %s",
    async (_name, { path, message }) => {
      expect(await httpSend({ method: "GET", path })).toEqual({
        status: 400,
        body: { code: "invalid_request", message },
      });
    }
  );

  it.each(["/v1/pieces/the-lay%2Fhistory", "/v1/collections/1%2f2/history"])(
    "answers 404 no such route over HTTP to %s",
    async path => {
      expect(await httpSend({ method: "GET", path })).toEqual({
        status: 404,
        body: { code: "not_found", message: "no such route" },
      });
    }
  );

  it("requires a match for a public operation's failure, then fails only that request", async () => {
    const fail = (failure: Record<string, unknown>) =>
      httpSend({ method: "POST", path: "/__fixtures/fail", ...json(failure) });
    expect(
      await fail({ operationId: "listPieces", status: 500, code: "internal" })
    ).toMatchObject({
      status: 400,
      body: { code: "invalid_request" },
    });
    expect(
      (
        await fail({
          operationId: "listPieces",
          status: 500,
          match: { q: "server-timeout-1" },
        })
      ).status
    ).toBe(204);
    expect(
      await httpSend({ method: "GET", path: "/v1/pieces?q=someone+else" })
    ).not.toMatchObject({ status: 500 });
    expect(
      await httpSend({ method: "GET", path: "/v1/pieces?q=server-timeout-1" })
    ).toEqual({
      status: 500,
      body: { code: "internal", message: "injected failure" },
    });
  });

  it.each([
    ["503", 503, "text/plain; charset=utf-8"],
    ["html-502", 502, "text/html; charset=utf-8"],
  ] as const)(
    "sends a %s outage as-is, with its content type",
    async (mode, status, contentType) => {
      const match = { slug: `server-outage-${mode}` };
      expect(
        (
          await httpSend({
            method: "POST",
            path: "/__fixtures/outage",
            ...json({ operationId: "getPiece", mode }),
          })
        ).status
      ).toBe(400);
      expect(
        (
          await httpSend({
            method: "POST",
            path: "/__fixtures/outage",
            ...json({ operationId: "getPiece", mode, match }),
          })
        ).status
      ).toBe(204);
      const response = await fetch(`${baseUrl}/v1/pieces/${match.slug}`);
      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toBe(contentType);
      expect(await response.text()).toContain(`${status} `);
    }
  );
});

describe("fixture server entry point", () => {
  it("listens on $PORT when run with tsx", { timeout: 20_000 }, async () => {
    const port = 40_000 + Math.floor(Math.random() * 10_000);
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "test/fixture-api/server.ts"],
      { env: { ...process.env, PORT: String(port) }, stdio: "pipe" }
    );
    try {
      const line = await new Promise<string>((resolve, reject) => {
        child.stdout.on("data", (chunk: Buffer) => resolve(chunk.toString()));
        child.on("exit", code => reject(new Error(`exited with ${code}`)));
      });
      expect(line.trim()).toBe(
        `Fixture API listening on http://127.0.0.1:${port}`
      );
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(await response.json()).toEqual({ status: "ok" });
    } finally {
      child.kill("SIGTERM");
    }
  });
});

/**
 * The e2e "socket hang up" (docs/TESTING.md): the server must never close an
 * idle keep-alive socket under a client that is about to reuse it.
 */
describe("fixture server keep-alive", () => {
  it("never times out idle keep-alive sockets", () => {
    expect(createFixtureServer().keepAliveTimeout).toBe(0);
  });

  it(
    "answers a second request on the same socket after 6.5 s idle",
    { timeout: 15_000 },
    async () => {
      const { port } = server.address() as AddressInfo;
      const socket = connect(port, "127.0.0.1");
      const received: string[] = [];
      let waiting: (() => void) | undefined;
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        received.push(chunk);
        waiting?.();
      });
      const closed = new Promise<"closed">(done =>
        socket.on("close", () => done("closed"))
      );
      const statuses = () =>
        [...received.join("").matchAll(/^HTTP\/1\.1 (\d{3})/gm)].map(
          ([, status]) => status
        );
      const responses = async (count: number) => {
        while (statuses().length < count) {
          const more = new Promise<"data">(done => {
            waiting = () => done("data");
          });
          if ((await Promise.race([more, closed])) === "closed") break;
        }
        return statuses();
      };
      const request =
        "GET /healthz HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n";
      try {
        socket.write(request);
        expect(await responses(1)).toEqual(["200"]);
        // Node's default keepAliveTimeout (5 s) plus its 1 s buffer.
        await new Promise(done => setTimeout(done, 6_500));
        socket.write(request);
        expect(await responses(2)).toEqual(["200", "200"]);
      } finally {
        socket.destroy();
      }
    }
  );
});
