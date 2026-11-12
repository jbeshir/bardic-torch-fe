import type { ActionFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { action as updateMe } from "~/routes/api.me";
import { action as logout } from "~/routes/auth.logout";
import { action as editBard } from "~/routes/bards.$slug.edit";
import { action as newBard } from "~/routes/bards.new";
import { action as editCategory } from "~/routes/categories.$slug.edit";
import { action as newCategory } from "~/routes/categories.new";
import { action as editCollection } from "~/routes/collections.$id.edit";
import { action as newCollection } from "~/routes/collections.new";
import { action as editEvent } from "~/routes/events.$slug.edit";
import { action as newEvent } from "~/routes/events.new";
import { action as withdraw } from "~/routes/contributions";
import { action as contact } from "~/routes/contact";
import { action as closeRequest } from "~/routes/moderation.contact";
import { action as takedown } from "~/routes/moderation.links";
import { action as review } from "~/routes/moderation.revisions.$id";
import { action as block } from "~/routes/moderation.users";
import { action as editPiece } from "~/routes/pieces.$slug.edit";
import { action as newPiece } from "~/routes/pieces.new";
import { action as saveTheme } from "~/routes/resources.theme";
import { APP_ORIGIN } from "~/test/context";
import { runAction } from "~/test/proxy";
import { assertSameOrigin } from "./csrf.server";

/**
 * Every route that changes state: each route module exporting a server
 * `action` must be here (checked below against the route files).
 */
const ROUTES: ReadonlyArray<{
  name: string;
  method: string;
  path: string;
  action: (args: ActionFunctionArgs) => Promise<unknown>;
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
    name: "/contributions",
    method: "POST",
    path: "/contributions",
    action: withdraw,
  },
  ...(
    [
      ["/events/:slug/edit", editEvent, { slug: "midwinter-revel" }],
      ["/events/new", newEvent, {}],
      ["/collections/:id/edit", editCollection, { id: "12" }],
      ["/collections/new", newCollection, {}],
      ["/categories/:slug/edit", editCategory, { slug: "swords" }],
      ["/categories/new", newCategory, {}],
      ["/pieces/:slug/edit", editPiece, { slug: "the-copper-kettle" }],
      ["/pieces/new", newPiece, {}],
      ["/bards/:slug/edit", editBard, { slug: "wren-of-the-vale" }],
      ["/bards/new", newBard, {}],
      ["/contact", contact, {}],
      ["/moderation/revisions/:id", review, { id: "1901" }],
      ["/moderation/contact", closeRequest, {}],
      ["/moderation/links", takedown, {}],
      ["/moderation/users", block, {}],
    ] as const
  ).map(([name, action, params]) => ({
    name,
    method: "POST",
    path: name.replace(/:\w+/, Object.values(params)[0] ?? ""),
    action,
    params,
  })),
];

type RouteModule = Readonly<Record<string, unknown>>;

/** Every route module, as React Router finds them (co-located tests excluded). */
const ROUTE_MODULES: Readonly<Record<string, RouteModule>> = import.meta.glob(
  ["../routes/**/*.{ts,tsx,js,jsx,md,mdx}", "!../routes/**/*.test.{ts,tsx}"],
  { eager: true }
);

function routeFilesExporting(name: string): string[] {
  return Object.entries(ROUTE_MODULES)
    .filter(([, module]) => typeof module[name] === "function")
    .map(([file]) => file)
    .sort();
}

describe("the table of state-changing routes", () => {
  it("lists every route file that exports an action", () => {
    const tabled = new Set<unknown>(ROUTES.map(route => route.action));
    const withAction = routeFilesExporting("action");
    expect(
      withAction.filter(file => !tabled.has(ROUTE_MODULES[file]?.action)),
      "route files exporting an action that ROUTES does not list"
    ).toEqual([]);
    expect(withAction).toHaveLength(ROUTES.length);
  });
});

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
