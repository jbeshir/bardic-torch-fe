import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { describe, expect, it } from "vitest";
import { action as updateMe } from "~/routes/api.me";
import { action as createToken } from "~/routes/api.tokens";
import { action as revokeToken } from "~/routes/api.tokens.$tokenId";
import { action as logout } from "~/routes/auth.logout";
import { action as saveTheme } from "~/routes/resources.theme";
import { APP_ORIGIN } from "~/test/context";
import { runAction } from "~/test/proxy";
import { assertSameOrigin } from "./csrf.server";

/** Every route that changes state. */
const ROUTES: ReadonlyArray<{
  name: string;
  method: string;
  path: string;
  action: (args: ActionFunctionArgs) => Promise<Response>;
  params?: Record<string, string>;
}> = [
  {
    name: "/auth/logout",
    method: "POST",
    path: "/auth/logout",
    action: logout,
  },
  {
    name: "/resources/theme",
    method: "POST",
    path: "/resources/theme",
    action: saveTheme,
  },
  { name: "/api/me", method: "PATCH", path: "/api/me", action: updateMe },
  {
    name: "/api/tokens",
    method: "POST",
    path: "/api/tokens",
    action: createToken,
  },
  {
    name: "/api/tokens/:tokenId",
    method: "DELETE",
    path: "/api/tokens/t1",
    action: revokeToken,
    params: { tokenId: "t1" },
  },
];

const REJECTED: ReadonlyArray<[string, Record<string, string>]> = [
  ["no Origin and no Sec-Fetch-Site", {}],
  ["a cross-site Origin", { Origin: "https://evil.example" }],
  ["a sibling subdomain", { Origin: "https://evil.app.test" }],
  ["a lookalike suffix", { Origin: "https://app.test.evil.example" }],
  ["a different scheme", { Origin: "http://app.test" }],
  ["a different port", { Origin: "https://app.test:8443" }],
  ["Origin: null", { Origin: "null" }],
  ["Sec-Fetch-Site: cross-site", { "Sec-Fetch-Site": "cross-site" }],
  ["Sec-Fetch-Site: same-site", { "Sec-Fetch-Site": "same-site" }],
  ["Sec-Fetch-Site: none", { "Sec-Fetch-Site": "none" }],
  [
    "a cross-site Origin claiming same-origin fetch metadata",
    { Origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" },
  ],
];

const ACCEPTED: ReadonlyArray<[string, Record<string, string>]> = [
  ["a matching Origin", { Origin: APP_ORIGIN }],
  [
    "no Origin with Sec-Fetch-Site: same-origin",
    { "Sec-Fetch-Site": "same-origin" },
  ],
];

function request(
  method: string,
  path: string,
  headers: Record<string, string>
) {
  return new Request(`${APP_ORIGIN}${path}`, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: "",
  });
}

describe("assertSameOrigin on every state-changing route", () => {
  describe.each(ROUTES)("$name", route => {
    it.each(REJECTED)("rejects %s with 403", async (_label, headers) => {
      const response = await runAction(
        route.action,
        request(route.method, route.path, headers),
        route.params
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("Set-Cookie")).toBeNull();
      expect(await response.json()).toEqual({
        ok: false,
        error: {
          code: "forbidden",
          message: "This request must come from the Bardic Torch site.",
        },
      });
    });

    it.each(ACCEPTED)("lets %s through", async (_label, headers) => {
      const response = await runAction(
        route.action,
        request(route.method, route.path, headers),
        route.params
      );
      expect(response.status).not.toBe(403);
    });
  });
});

describe("assertSameOrigin", () => {
  it("compares against the request's own origin, port included", () => {
    const local = new Request("http://127.0.0.1:8788/api/me", {
      method: "PATCH",
      headers: { Origin: "http://127.0.0.1:8788" },
    });
    expect(() => assertSameOrigin(local)).not.toThrow();
  });
});
