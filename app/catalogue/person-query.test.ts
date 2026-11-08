import { describe, expect, it } from "vitest";
import {
  personQuery,
  redirectIfNotCanonical,
  type PersonQueryState,
} from "./query-state";

// personQuery (/bards, plan §2.6): the shared rules of §2.2 on the bards'
// parameters. pieceQuery's table (query-state.test.ts) covers the rules
// themselves; this one each of /bards' own parameters.

const EMPTY: PersonQueryState = {
  q: undefined,
  kind: [],
  role: [],
  affiliation: undefined,
  letter: undefined,
  sort: undefined,
  page: 1,
};

const parse = (search: string) =>
  personQuery.parse(new URLSearchParams(search));

function redirectFor(search: string): string | null {
  const url = new URL(`https://app.test/bards${search}`);
  try {
    redirectIfNotCanonical(url, parse(url.search).canonical);
    return null;
  } catch (thrown) {
    if (!(thrown instanceof Response)) throw thrown;
    expect(thrown.status).toBe(301);
    return thrown.headers.get("Location");
  }
}

const ROWS: readonly (readonly [string, string, string, 200 | 301])[] = [
  ["no query", "", "", 200],
  ["a search", "?q=wren", "?q=wren", 200],
  ["a kind", "?kind=group", "?kind=group", 200],
  [
    "kinds in the API's order",
    "?kind=group&kind=community_bard",
    "?kind=community_bard&kind=group",
    200,
  ],
  ["an upper-case kind", "?kind=Group", "?kind=group", 301],
  ["an unknown kind", "?kind=wizard", "", 301],
  ["a duplicate kind", "?kind=group&kind=group", "?kind=group", 301],
  [
    "roles in the API's order",
    "?role=poet&role=singer",
    "?role=singer&role=poet",
    200,
  ],
  ["an unknown role", "?role=bard", "", 301],
  ["an affiliation", "?affiliation=northmarch", "?affiliation=northmarch", 200],
  [
    "an upper-case affiliation",
    "?affiliation=Northmarch",
    "?affiliation=northmarch",
    301,
  ],
  ["an affiliation that isn't a slug", "?affiliation=north--march", "", 301],
  ["an empty affiliation", "?affiliation=", "", 301],
  [
    "two affiliations: the first kept",
    "?affiliation=northmarch&affiliation=caer-wyn",
    "?affiliation=northmarch",
    301,
  ],
  ["a letter", "?letter=W", "?letter=W", 200],
  ["a lower-case letter", "?letter=w", "?letter=W", 301],
  ["name order with a search", "?q=wren&sort=name", "?q=wren&sort=name", 200],
  ["name order without a search (the default)", "?sort=name", "", 301],
  [
    "relevance with a search (the default)",
    "?q=wren&sort=relevance",
    "?q=wren",
    301,
  ],
  [
    "relevance without a search (refused by the API)",
    "?sort=relevance",
    "",
    301,
  ],
  ["the pieces' sort", "?q=wren&sort=title", "?q=wren", 301],
  ["page 2", "?page=2", "?page=2", 200],
  ["page 1", "?page=1", "", 301],
  ["an unknown parameter", "?term=war", "", 301],
  [
    "every parameter, out of order",
    "?page=2&letter=W&affiliation=northmarch&role=singer&kind=group&q=wren&sort=name",
    "?q=wren&kind=group&role=singer&affiliation=northmarch&letter=W&sort=name&page=2",
    200,
  ],
];

describe("personQuery", () => {
  it.each(ROWS)("%s: %s → %s (%s)", (_why, search, canonical, status) => {
    expect(parse(search).canonical).toBe(canonical);
    expect(redirectFor(search)).toBe(
      status === 301 ? `/bards${canonical}` : null
    );
    // The canonical form is answered, parses to the same state and is what
    // href gives for it.
    expect(redirectFor(canonical)).toBeNull();
    expect(parse(canonical).state).toEqual(parse(search).state);
    expect(
      personQuery.href(parse(canonical).state, {
        page: parse(canonical).state.page,
      })
    ).toBe(`/bards${canonical}`);
  });

  it("asks the API with its own names, in the spec's order", () => {
    expect(
      personQuery.toApi({
        ...EMPTY,
        q: "wren",
        kind: ["group"],
        role: ["singer"],
        affiliation: "northmarch",
        letter: "W",
        sort: "name",
        page: 3,
      })
    ).toEqual({
      kind: ["group"],
      role: ["singer"],
      affiliation: "northmarch",
      q: "wren",
      letter: "W",
      sort: "name",
      limit: 50,
      offset: 100,
    });
    expect(personQuery.toApi(EMPTY)).toEqual({ limit: 50, offset: 0 });
  });

  it("links a change from page 1, and drops an order a change makes moot", () => {
    const state = { ...EMPTY, q: "wren", sort: "name" as const, page: 4 };
    expect(personQuery.href(state, { letter: "W" })).toBe(
      "/bards?q=wren&letter=W&sort=name"
    );
    expect(personQuery.href(state, { q: undefined })).toBe("/bards");
    expect(personQuery.href(state, { page: 5 })).toBe(
      "/bards?q=wren&sort=name&page=5"
    );
  });
});
