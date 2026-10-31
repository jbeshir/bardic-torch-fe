import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import { createReturnToCookie } from "~/server/return-to.server";
import { loadContext } from "~/test/context";
import { loader as callback } from "./auth.callback";
import { loader as login } from "./auth.login";

const SECRET = loadContext().cloudflare.env.AUTH_SESSION_SECRET;

const ID_TOKEN = [
  "header",
  btoa(JSON.stringify({ sub: "auth0|42", email: "bard@example.test" })),
  "signature",
].join(".");

/** Codes the fake Auth0 token endpoint received. */
const exchangedCodes: string[] = [];
const server = setupServer();

function auth0TokenEndpoint(respond: () => Response) {
  server.use(
    http.post("https://auth0.test/oauth/token", async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      exchangedCodes.push(form.get("code") ?? "");
      return respond();
    })
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  auth0TokenEndpoint(() =>
    HttpResponse.json({
      access_token: "access-42",
      id_token: ID_TOKEN,
      refresh_token: "refresh-42",
      expires_in: 3600,
      token_type: "Bearer",
    })
  );
});
afterEach(() => {
  server.resetHandlers();
  exchangedCodes.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function cookiePairs(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .map(value => value.split(";")[0] ?? "");
}

/** Start a login and return what the browser brings back to the callback. */
async function startLogin(returnTo?: string) {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const response = await login({
    request: new Request(`https://app.test/auth/login${query}`),
    params: {},
    context: loadContext(),
  });
  const state = new URL(
    response.headers.get("Location") ?? ""
  ).searchParams.get("state");
  return { state: state ?? "", cookies: cookiePairs(response) };
}

function runCallback(query: string, cookies: readonly string[]) {
  return callback({
    request: new Request(`https://app.test/auth/callback?${query}`, {
      headers: { Cookie: cookies.join("; ") },
    }),
    params: {},
    context: loadContext(),
  });
}

async function sessionUserFrom(response: Response) {
  const session = await getOrCreateSessionStorage({
    AUTH_SESSION_SECRET: SECRET,
  }).getSession(
    cookiePairs(response).find(pair => pair.startsWith("__Host-bt_session="))
  );
  return session.get("user");
}

function expectReturnToCleared(response: Response) {
  const cleared = response.headers
    .getSetCookie()
    .find(value => value.startsWith("__Host-bt_return_to="));
  expect(cleared).toMatch(/^__Host-bt_return_to=[^;]*;/);
  expect(cleared).toContain("Max-Age=0");
}

describe("/auth/callback", () => {
  it("creates the session and redirects to the returnTo stored at login", async () => {
    const { state, cookies } = await startLogin("/help/licence");
    const response = await runCallback(`code=abc&state=${state}`, cookies);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/help/licence");
    expect(exchangedCodes).toEqual(["abc"]);
    expect(await sessionUserFrom(response)).toMatchObject({
      id: "auth0|42",
      email: "bard@example.test",
      accessToken: "access-42",
      refreshToken: "refresh-42",
    });
    expectReturnToCleared(response);
  });

  it("ignores a returnTo in the callback's query string", async () => {
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(
      `code=abc&state=${state}&returnTo=%2Fsettings`,
      cookies
    );
    expect(response.headers.get("Location")).toBe("/help");
    expect(await sessionUserFrom(response)).toBeDefined();
  });

  it("validates the stored returnTo again", async () => {
    const { state, cookies } = await startLogin();
    const forged = await createReturnToCookie(SECRET).serialize("//evil.com");
    const response = await runCallback(`code=abc&state=${state}`, [
      ...cookies.filter(pair => !pair.startsWith("__Host-bt_return_to=")),
      forged.split(";")[0] ?? "",
    ]);
    expect(response.headers.get("Location")).toBe("/");
    expect(await sessionUserFrom(response)).toBeDefined();
  });

  it("ignores a returnTo cookie signed with another secret", async () => {
    const { state, cookies } = await startLogin();
    const foreign = await createReturnToCookie(
      "another-secret-of-at-least-32-chars"
    ).serialize("/settings");
    const response = await runCallback(`code=abc&state=${state}`, [
      ...cookies.filter(pair => !pair.startsWith("__Host-bt_return_to=")),
      foreign.split(";")[0] ?? "",
    ]);
    expect(response.headers.get("Location")).toBe("/");
    expect(await sessionUserFrom(response)).toBeDefined();
  });

  it.each([
    ["a state that doesn't match the cookie", "code=abc&state=forged"],
    ["an Auth0 error", "error=access_denied&error_description=no"],
  ])(
    "on %s redirects home without a session and clears returnTo",
    async (_name, query) => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const { state, cookies } = await startLogin("/help");
      const response = await runCallback(
        query.includes("state=") ? query : `${query}&state=${state}`,
        cookies
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/");
      expect(await sessionUserFrom(response)).toBeUndefined();
      expectReturnToCleared(response);
      expect(exchangedCodes).toEqual([]);
      expect(error).toHaveBeenCalled();
    }
  );

  it("redirects home without a session when the code exchange fails", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    auth0TokenEndpoint(() =>
      HttpResponse.json({ error: "invalid_grant" }, { status: 400 })
    );
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(`code=abc&state=${state}`, cookies);

    expect(response.headers.get("Location")).toBe("/");
    expect(await sessionUserFrom(response)).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
