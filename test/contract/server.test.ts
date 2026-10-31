import { spawn } from "node:child_process";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFixtureServer } from "../fixture-api/server";
import { responseProblems } from "../fixture-api/spec";
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

describe("fixture server entry point", () => {
  it("listens on $PORT when run with tsx", async () => {
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
  }, 20_000);
});
