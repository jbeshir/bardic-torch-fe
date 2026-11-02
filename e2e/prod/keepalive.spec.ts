import { connect } from "node:net";
import { expect } from "@playwright/test";
import { test } from "../support/test";

/**
 * Playwright's API requests share one keep-alive agent per process, so a
 * server that closes an idle socket just as the client reuses it fails the
 * request with "socket hang up" (docs/TESTING.md). The fixture API never
 * closes one (`keepAliveTimeout = 0`, test/contract/server.test.ts). This
 * pins the same for the app server, `wrangler dev` on port 8788: a second
 * request on one socket, after longer idle than Node's default timeout
 * plus its buffer, is still answered. A wrangler that starts closing idle
 * sockets fails here instead of flaking elsewhere.
 */
test("the app server answers a second request on the same socket after 6.5 s idle", async ({
  baseURL,
}) => {
  const { host, port } = new URL(baseURL ?? "");
  // wrangler dev listens on 127.0.0.1 only (playwright.config.ts).
  const socket = connect(Number(port), "127.0.0.1");
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
  // A static file FE1 ships: the request needs no fixture data.
  const request = `GET /favicon.svg HTTP/1.1\r\nHost: ${host}\r\nConnection: keep-alive\r\n\r\n`;
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
});
