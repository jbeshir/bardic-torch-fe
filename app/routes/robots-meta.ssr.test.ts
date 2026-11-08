import { afterEach, describe, expect, it, vi } from "vitest";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as notFoundModule from "./$";
import * as indexModule from "./_index";
import * as bardLayout from "./bards.$slug";
import * as bardRead from "./bards.$slug._index";
import * as bardHistory from "./bards.$slug.history";
import * as bardsModule from "./bards._index";
import * as categoriesModule from "./categories._index";
import * as pieceLayout from "./pieces.$slug";
import * as pieceRead from "./pieces.$slug._index";
import * as pieceHistory from "./pieces.$slug.history";
import * as piecesModule from "./pieces._index";
import * as revisionModule from "./revisions.$id";
import * as searchModule from "./search";

// The robots meta of every kind of page, in one table (plan C10.1): which
// pages are indexed, which are followed but not indexed, which are neither.
// Each page's own SSR test checks the rest of its document.

serveFixtureApi();

const PIECE = "routes/pieces.$slug";
const BARD = "routes/bards.$slug";
const get = serveApp([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: true },
  {
    id: "routes/pieces._index",
    path: "pieces",
    module: piecesModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/search",
    path: "search",
    module: searchModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: PIECE,
    path: "pieces/:slug",
    module: pieceLayout,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: `${PIECE}._index`,
    parentId: PIECE,
    index: true,
    module: pieceRead,
    hasLoader: false,
  },
  {
    id: `${PIECE}.history`,
    parentId: PIECE,
    path: "history",
    module: pieceHistory,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/bards._index",
    path: "bards",
    module: bardsModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: BARD,
    path: "bards/:slug",
    module: bardLayout,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: `${BARD}._index`,
    parentId: BARD,
    index: true,
    module: bardRead,
    hasLoader: false,
  },
  {
    id: `${BARD}.history`,
    parentId: BARD,
    path: "history",
    module: bardHistory,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/categories._index",
    path: "categories",
    module: categoriesModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/revisions.$id",
    path: "revisions/:id",
    module: revisionModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/$",
    path: "*",
    module: notFoundModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

afterEach(() => {
  vi.restoreAllMocks();
});

/** The robots meta content of the page at `path`, or null without one. */
async function robotsOf(path: string, status = 200): Promise<string | null> {
  const response = await get(path);
  expect(response.status, path).toBe(status);
  const html = await response.text();
  return /<meta name="robots" content="([^"]*)"\/?>/.exec(html)?.[1] ?? null;
}

describe("robots meta by page state", () => {
  it.each([
    ["the home page", "/"],
    ["the piece browse", "/pieces"],
    ["a later page of the browse", "/pieces?page=2"],
    ["a letter page", "/pieces?letter=T"],
    ["a piece", "/pieces/the-copper-kettle"],
    ["the bards directory", "/bards"],
    ["a bard", "/bards/the-greywater-minstrels"],
    ["the categories index", "/categories"],
  ])("indexes %s (no robots meta)", async (_what, path) => {
    expect(await robotsOf(path)).toBeNull();
  });

  it.each([
    ["a filtered list", "/pieces?kind=song"],
    ["a text search of the browse", "/pieces?q=kettle"],
    ["a search", "/search?q=kettle"],
    ["the empty search page", "/search"],
    ["a piece's history", "/pieces/the-copper-kettle/history"],
    ["a bard's history", "/bards/the-greywater-minstrels/history"],
    ["a revision", "/revisions/1003"],
  ])("follows but does not index %s", async (_what, path) => {
    expect(await robotsOf(path)).toBe("noindex, follow");
  });

  it.each([
    ["a restricted piece", "/pieces/the-dragons-hoard"],
    ["a person without a page", "/bards/hollis-fenn"],
  ])("neither indexes nor follows %s", async (_what, path) => {
    expect(await robotsOf(path)).toBe("noindex, nofollow");
  });

  it("does not index a 404", async () => {
    expect(await robotsOf("/no-such-page", 404)).toBe("noindex");
    expect(await robotsOf("/pieces/no-such-piece", 404)).toBe("noindex");
  });
});
