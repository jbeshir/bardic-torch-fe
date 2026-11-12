import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, sessionCookie, sessionTokens } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import stylesheetUrl from "../../test/support/stylesheet-url";
import * as notFound from "./$";
import * as home from "./_index";
import * as bardLayout from "./bards.$slug";
import * as bardRead from "./bards.$slug._index";
import * as bardEdit from "./bards.$slug.edit";
import * as bardHistory from "./bards.$slug.history";
import * as bards from "./bards._index";
import * as bardNew from "./bards.new";
import * as categoryLayout from "./categories.$slug";
import * as categoryRead from "./categories.$slug._index";
import * as categoryEdit from "./categories.$slug.edit";
import * as categories from "./categories._index";
import * as categoryNew from "./categories.new";
import * as collectionLayout from "./collections.$id";
import * as collectionRead from "./collections.$id._index";
import * as collectionEdit from "./collections.$id.edit";
import * as collections from "./collections._index";
import * as collectionNew from "./collections.new";
import * as eventLayout from "./events.$slug";
import * as eventRead from "./events.$slug._index";
import * as eventEdit from "./events.$slug.edit";
import * as events from "./events._index";
import * as eventNew from "./events.new";
import * as helpPage from "./help.$slug";
import * as help from "./help._index";
import * as pieceLayout from "./pieces.$slug";
import * as pieceRead from "./pieces.$slug._index";
import * as pieceEdit from "./pieces.$slug.edit";
import * as pieceHistory from "./pieces.$slug.history";
import * as pieces from "./pieces._index";
import * as pieceNew from "./pieces.new";
import * as revision from "./revisions.$id";
import * as robots from "./robots[.]txt";
import * as search from "./search";
import * as contributions from "./contributions";
import * as contact from "./contact";
import * as moderationInbox from "./moderation.contact";
import * as moderationQueue from "./moderation._index";
import * as moderationLinks from "./moderation.links";
import * as moderationReview from "./moderation.revisions.$id";
import * as moderationUsers from "./moderation.users";
import * as needsWork from "./needs-work";
import * as settings from "./settings";
import * as sitemap from "./sitemap[.]xml";

// Every route through the real server entry and root, against the fixture
// API: what the browser gets before any JavaScript runs.

const fixtures = serveFixtureApi();

type Module = Parameters<typeof serveApp>[0][number]["module"];

const route = (id: string, path: string, module: Module) => ({
  id: `routes/${id}`,
  path,
  module,
  hasLoader: true,
  hasErrorBoundary: true,
});
/** The index route, or the history or edit route, under `layout`'s route. */
const child = (layout: string, module: Module, path?: string) => ({
  id: `routes/${layout}${path ? `.${path}` : "._index"}`,
  parentId: `routes/${layout}`,
  module,
  hasLoader: path !== undefined,
  hasErrorBoundary: path !== undefined,
  ...(path === undefined ? { index: true as const } : { path }),
});

const get = serveApp([
  { id: "routes/_index", index: true, module: home, hasLoader: true },
  route("$", "*", notFound),
  route("pieces._index", "pieces", pieces),
  route("pieces.$slug", "pieces/:slug", pieceLayout),
  child("pieces.$slug", pieceRead),
  child("pieces.$slug", pieceHistory, "history"),
  child("pieces.$slug", pieceEdit, "edit"),
  route("pieces.new", "pieces/new", pieceNew),
  route("bards._index", "bards", bards),
  route("bards.$slug", "bards/:slug", bardLayout),
  child("bards.$slug", bardRead),
  child("bards.$slug", bardHistory, "history"),
  child("bards.$slug", bardEdit, "edit"),
  route("bards.new", "bards/new", bardNew),
  route("categories._index", "categories", categories),
  route("categories.$slug", "categories/:slug", categoryLayout),
  child("categories.$slug", categoryRead),
  child("categories.$slug", categoryEdit, "edit"),
  route("categories.new", "categories/new", categoryNew),
  route("collections._index", "collections", collections),
  route("collections.$id", "collections/:id", collectionLayout),
  child("collections.$id", collectionRead),
  child("collections.$id", collectionEdit, "edit"),
  route("collections.new", "collections/new", collectionNew),
  route("events._index", "events", events),
  route("events.$slug", "events/:slug", eventLayout),
  child("events.$slug", eventRead),
  child("events.$slug", eventEdit, "edit"),
  route("events.new", "events/new", eventNew),
  route("revisions.$id", "revisions/:id", revision),
  route("search", "search", search),
  route("contributions", "contributions", contributions),
  route("needs-work", "needs-work", needsWork),
  route("contact", "contact", contact),
  route("moderation._index", "moderation", moderationQueue),
  route(
    "moderation.revisions.$id",
    "moderation/revisions/:id",
    moderationReview
  ),
  route("moderation.contact", "moderation/contact", moderationInbox),
  route("moderation.links", "moderation/links", moderationLinks),
  route("moderation.users", "moderation/users", moderationUsers),
  route("settings", "settings", settings),
  { ...route("help._index", "help", help), hasLoader: false },
  route("help.$slug", "help/:slug", helpPage),
  route("robots[.]txt", "robots.txt", robots),
  route("sitemap[.]xml", "sitemap.xml", sitemap),
]);

afterEach(() => {
  vi.restoreAllMocks();
});

type Check =
  | { readonly h1: string }
  | { readonly location: string }
  | { readonly contains: string };

const PAGES: readonly (readonly [string, number, Check])[] = [
  [
    "/",
    200,
    { h1: "Find the songs, stories and poems of the bardic community." },
  ],
  ["/pieces", 200, { h1: "Pieces" }],
  ["/pieces?kind=poem&term=eerie", 200, { contains: "Showing 3 pieces" }],
  ["/pieces?letter=T", 200, { contains: "Pieces under T" }],
  ["/pieces?q=zzzznothing", 200, { contains: "Nothing matches ‘zzzznothing’" }],
  ["/pieces/the-copper-kettle", 200, { h1: "The Copper Kettle" }],
  ["/pieces/the-dragons-hoard", 200, { h1: "The Dragon’s Hoard" }],
  ["/pieces/the-unfinished-lay", 200, { h1: "The Unfinished Lay" }],
  ["/pieces/the-copper-kettle/history", 200, { h1: "The Copper Kettle" }],
  ["/revisions/1003", 200, { h1: "Revision 1003 of The Copper Kettle" }],
  ["/search?q=northmarch", 200, { h1: "Search" }],
  ["/bards", 200, { h1: "Bards" }],
  ["/bards?letter=W", 200, { h1: "Bards" }],
  ["/bards/wren-of-the-vale", 200, { h1: "Wren of the Vale" }],
  ["/bards/hollis-fenn", 200, { h1: "Hollis Fenn" }],
  ["/categories", 200, { h1: "Categories" }],
  ["/categories/swords", 200, { h1: "Swords" }],
  ["/collections", 200, { h1: "Collections" }],
  ["/collections/12", 200, { h1: "The Northmarch Songbook" }],
  ["/events", 200, { h1: "Events and venues" }],
  ["/events/midwinter-revel", 200, { h1: "Midwinter Revel" }],
  ["/events/new", 302, { location: "/auth/login?returnTo=%2Fevents%2Fnew" }],
  ["/needs-work", 200, { h1: "Needs work" }],
  ["/contact", 200, { h1: "Contact us" }],
  ["/moderation", 302, { location: "/auth/login?returnTo=%2Fmoderation" }],
  ["/help", 200, { h1: "Help" }],
  ["/help/conservation-status", 200, { h1: "Conservation status" }],
  ["/settings", 200, { contains: "<title>Settings" }],
  ["/wiki/Northmarch_Rising", 404, { contains: "/search?q=Northmarch+Rising" }],
  ["/pieces/no-such-piece", 404, { h1: "We couldn’t find that piece" }],
  ["/collections/abc", 404, { h1: "We couldn’t find that collection" }],
  ["/pieces?kind=Song", 301, { location: "/pieces" }],
  ["/pieces?page=99", 302, { location: "/pieces?page=5" }],
  ["/pieces?term=no-longer-a-term", 200, { contains: "we left them out" }],
  ["/", 200, { contains: `href="${stylesheetUrl}"` }],
  ["/robots.txt", 200, { contains: "Sitemap:" }],
  ["/sitemap.xml", 200, { contains: "<urlset" }],
];

/** The editors, as the fixture contributor: each edit and new page. */
const EDITOR_PAGES: readonly (readonly [string, string])[] = [
  ["/contributions", "My contributions"],
  ["/events/midwinter-revel/edit", "Midwinter Revel"],
  ["/events/new", "New event or venue"],
  ["/collections/12/edit", "The Northmarch Songbook"],
  ["/collections/new", "New collection"],
  ["/categories/swords/edit", "Swords"],
  ["/categories/new", "New category"],
  ["/pieces/the-copper-kettle/edit", "The Copper Kettle"],
  ["/pieces/new", "New piece"],
  ["/bards/wren-of-the-vale/edit", "Wren of the Vale"],
  ["/bards/new", "New bard or group"],
];

/** The moderators' pages, as the fixture moderator. */
const MODERATOR_PAGES: readonly (readonly [string, string])[] = [
  ["/moderation", "Moderation queue"],
  ["/moderation/revisions/1901", "Edit of The Copper Kettle"],
  ["/moderation/contact", "Contact inbox"],
  [
    "/moderation/links?url=https%3A%2F%2Fvideo.example%2Fwatch%2Fkettle-hearth",
    "Take down a link",
  ],
  ["/moderation/users", "Block a user"],
];

describe("server-rendered routes", () => {
  it.each(PAGES)("%s answers %i", async (url, status, check) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get(url);
    expect(response.status).toBe(status);
    if ("location" in check) {
      expect(response.headers.get("Location")).toBe(check.location);
      return;
    }
    const html = await response.text();
    if ("contains" in check) expect(html).toContain(check.contains);
    else
      expect(
        /<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1]?.replace(/<[^>]*>/g, "")
      ).toBe(check.h1);
  });

  it.each(EDITOR_PAGES)("%s answers 200 signed in", async (url, h1) => {
    const cookie = await sessionCookie(
      sessionTokens({ accessToken: "fixture:contributor" })
    );
    const html = await (await get(url, cookie)).text();
    expect(/<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1]).toBe(h1);
  });

  it("shows a rejected contribution's note to its author", async () => {
    const cookie = await sessionCookie(
      sessionTokens({ accessToken: "fixture:contributor" })
    );
    const html = await (await get("/contributions", cookie)).text();
    expect(html).toMatch(
      /Not accepted<p [^>]*>Note: Please say where the profile’s details come from\.<\/p>/
    );
  });

  it.each(MODERATOR_PAGES)("%s answers 200 to a moderator", async (url, h1) => {
    const cookie = await sessionCookie(
      sessionTokens({ accessToken: "fixture:moderator" })
    );
    const response = await get(url, cookie);
    expect(response.status).toBe(200);
    expect(/<h1[^>]*>(.*?)<\/h1>/s.exec(await response.text())?.[1]).toBe(h1);
  });

  it("is the resting page (503, Retry-After) when the API is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(
        `${API_BASE_URL}/v1/pieces`,
        () => new HttpResponse(null, { status: 503 })
      )
    );
    const response = await get("/pieces");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("is the same resting page (503) when the API's answer can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(
        `${API_BASE_URL}/v1/pieces`,
        () => new HttpResponse("<html>", { status: 200 })
      )
    );
    const response = await get("/pieces");
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Bardic Torch is resting");
  });
});
