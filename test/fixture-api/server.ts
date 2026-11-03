import { createServer, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { createFixtureState, handleFixtureRequest } from "./router";

/**
 * The fixture API over HTTP, for Playwright and `npm run dev:fixtures`:
 * `tsx test/fixture-api/server.ts` listens on 127.0.0.1:$PORT (default 4010).
 */

/** Hard cap on what is read; the router answers 413 above the API's limit. */
const MAX_READ_BYTES = 64 * 1024;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response
    .writeHead(status, { "Content-Type": "application/json" })
    .end(JSON.stringify(body));
}

export function createFixtureServer(): Server {
  const state = createFixtureState();
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += (chunk as Buffer).byteLength;
      if (size > MAX_READ_BYTES) {
        sendJson(response, 413, {
          code: "request_too_large",
          message: "request body is too large",
        });
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const { pathname } = new URL(request.url ?? "/", "http://fixture.invalid");
    let result;
    try {
      result = handleFixtureRequest(state, {
        method: request.method ?? "GET",
        pathname,
        authorization: request.headers.authorization ?? null,
        contentType: request.headers["content-type"] ?? null,
        body: Buffer.concat(chunks).toString("utf8"),
      });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { code: "internal", message: String(error) });
      return;
    }
    if (result.body === undefined) {
      response.writeHead(result.status).end();
      return;
    }
    sendJson(response, result.status, result.body);
  });
  // Never close an idle keep-alive socket: only the client, which knows when
  // it reuses one, ends the connection. With Node's default (5 s, plus a 1 s
  // buffer) a client whose event loop runs late (a Playwright worker busy
  // with axe and screenshots, or workerd) can send on a socket the server
  // has just closed, and gets ECONNRESET "socket hang up". `server.close()`
  // still closes idle sockets on shutdown.
  server.keepAliveTimeout = 0;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT ?? 4010);
  const server = createFixtureServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Fixture API listening on http://127.0.0.1:${port}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
