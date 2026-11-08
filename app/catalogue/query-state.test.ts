import { describe, expect, it } from "vitest";
import {
  categoryIndexQuery,
  collectionQuery,
  eventQuery,
  historyQuery,
  pieceQuery,
  redirectIfNotCanonical,
  termMembersQuery,
  type PieceQueryState,
} from "./query-state";

const EMPTY: PieceQueryState = {
  q: undefined,
  term: [],
  kind: [],
  status: [],
  stub: undefined,
  letter: undefined,
  sort: undefined,
  page: 1,
};

function parse(search: string) {
  return pieceQuery.parse(new URLSearchParams(search));
}

/** The redirect `redirectIfNotCanonical` throws for `search`, or null. */
function redirectFor(search: string): string | null {
  const url = new URL(`https://app.test/pieces${search}`);
  try {
    redirectIfNotCanonical(url, parse(url.search).canonical);
    return null;
  } catch (thrown) {
    if (!(thrown instanceof Response)) {
      throw thrown;
    }
    expect(thrown.status).toBe(301);
    return thrown.headers.get("Location");
  }
}

/**
 * The query-state table (plan §2.2): a request's query, its canonical form,
 * and whether it is redirected there (301) or answered as it is (200, an
 * order-only or encoding-only difference).
 */
const TABLE: readonly (readonly [
  why: string,
  search: string,
  canonical: string,
  answer: 200 | 301,
])[] = [
  // Already canonical.
  ["no query", "", "", 200],
  ["a search", "?q=kettle", "?q=kettle", 200],
  ["a letter", "?letter=T", "?letter=T", 200],
  ["page 2", "?page=2", "?page=2", 200],
  [
    "every parameter, in order",
    "?q=kettle&term=eerie&term=war&kind=song&kind=poem&status=low_risk&status=endangered&stub=true&letter=W&sort=title&page=3",
    "?q=kettle&term=eerie&term=war&kind=song&kind=poem&status=low_risk&status=endangered&stub=true&letter=W&sort=title&page=3",
    200,
  ],
  ["the zero letter", "?letter=0", "?letter=0", 200],
  ["a search with a space as +", "?q=wild+heron", "?q=wild+heron", 200],
  // Rule 1: unknown names.
  ["an unknown parameter", "?utm_source=x", "", 301],
  ["the API's offset", "?offset=50", "", 301],
  ["the API's limit", "?limit=10", "", 301],
  ["the API's conservation_status", "?conservation_status=endangered", "", 301],
  [
    "an unknown parameter beside a known one",
    "?letter=T&ref=home",
    "?letter=T",
    301,
  ],
  // Rule 2: repeatable parameters.
  ["terms out of order", "?term=war&term=eerie", "?term=eerie&term=war", 200],
  ["a duplicate term", "?term=war&term=war", "?term=war", 301],
  ["an upper-case term", "?term=War", "?term=war", 301],
  ["a term with spaces", "?term=%20war%20", "?term=war", 301],
  ["a term that isn't a slug", "?term=war--songs", "", 301],
  ["a term with a slash", "?term=war%2Fsongs", "", 301],
  ["an empty term", "?term=", "", 301],
  ["a term over 191 characters", `?term=${"a".repeat(192)}`, "", 301],
  [
    "a term of 191 characters",
    `?term=${"a".repeat(191)}`,
    `?term=${"a".repeat(191)}`,
    200,
  ],
  [
    "more than 20 terms",
    `?${Array.from({ length: 22 }, (_, i) => `term=t${String(i).padStart(2, "0")}`).join("&")}`,
    `?${Array.from({ length: 20 }, (_, i) => `term=t${String(i).padStart(2, "0")}`).join("&")}`,
    301,
  ],
  [
    "kinds out of enum order",
    "?kind=poem&kind=song",
    "?kind=song&kind=poem",
    200,
  ],
  ["an upper-case kind", "?kind=Song", "?kind=song", 301],
  ["an unknown kind", "?kind=ballad", "", 301],
  ["a duplicate kind", "?kind=song&kind=song", "?kind=song", 301],
  [
    "statuses out of enum order",
    "?status=restricted&status=unassessed",
    "?status=unassessed&status=restricted",
    200,
  ],
  ["an unknown status", "?status=extinct", "", 301],
  ["a status in upper case", "?status=LOW_RISK", "?status=low_risk", 301],
  // Rule 3: a scalar given twice.
  ["two letters", "?letter=A&letter=B", "?letter=A", 301],
  [
    "an invalid letter, then a valid one",
    "?letter=%C3%A9&letter=B",
    "?letter=B",
    301,
  ],
  ["two searches", "?q=kettle&q=heron", "?q=kettle", 301],
  ["a blank search, then a real one", "?q=+&q=heron", "?q=heron", 301],
  ["two stubs", "?stub=true&stub=false", "?stub=true", 301],
  ["two pages", "?page=2&page=3", "?page=2", 301],
  // Rule 4: q.
  ["an empty search", "?q=", "", 301],
  ["a blank search", "?q=%20%09%0A", "", 301],
  ["a search with blank ends", "?q=%20kettle%0A", "?q=kettle", 301],
  ["a no-break space is a character", "?q=%C2%A0", "?q=%C2%A0", 200],
  ["case is kept", "?q=Kettle", "?q=Kettle", 200],
  [
    "200 code points",
    `?q=${"é".repeat(200)}`,
    `?q=${encodeURIComponent("é".repeat(200))}`,
    200,
  ],
  [
    "201 code points",
    `?q=${"é".repeat(201)}`,
    `?q=${encodeURIComponent("é".repeat(200))}`,
    301,
  ],
  [
    "a cut that would end in a space",
    `?q=${"a".repeat(199)}+b`,
    `?q=${"a".repeat(199)}`,
    301,
  ],
  [
    "astral code points count once",
    `?q=${"🎻".repeat(200)}`,
    `?q=${encodeURIComponent("🎻".repeat(200))}`,
    200,
  ],
  // Rule 5: letter.
  ["a lower-case letter", "?letter=a", "?letter=A", 301],
  ["an empty letter", "?letter=", "", 301],
  ["two characters", "?letter=AB", "", 301],
  ["an accented letter", "?letter=%C3%89", "", 301],
  // Rule 6: sort.
  ["relevance without q", "?sort=relevance", "", 301],
  ["title without q (the default)", "?sort=title", "", 301],
  [
    "relevance with q (the default)",
    "?q=kettle&sort=relevance",
    "?q=kettle",
    301,
  ],
  ["title with q", "?q=kettle&sort=title", "?q=kettle&sort=title", 200],
  ["an upper-case sort", "?q=kettle&sort=Title", "?q=kettle&sort=title", 301],
  ["an unknown sort", "?q=kettle&sort=newest", "?q=kettle", 301],
  // Rule 7: stub.
  ["stubs only", "?stub=true", "?stub=true", 200],
  ["hiding stubs", "?stub=false", "?stub=false", 200],
  ["stub in upper case", "?stub=TRUE", "?stub=true", 301],
  ["stub as 1", "?stub=1", "", 301],
  // Rule 8: page.
  ["page 1", "?page=1", "", 301],
  ["page 0", "?page=0", "", 301],
  ["a negative page", "?page=-2", "", 301],
  ["a leading zero", "?page=02", "", 301],
  ["a fraction", "?page=2.5", "", 301],
  ["junk", "?page=two", "", 301],
  [
    "a page past the API (settled after the fetch)",
    "?page=999",
    "?page=999",
    200,
  ],
  ["an absurd page", "?page=99999999999999999999", "", 301],
  // Rule 9: order.
  ["letter before q", "?letter=T&q=kettle", "?q=kettle&letter=T", 200],
  ["page first", "?page=2&letter=T", "?letter=T&page=2", 200],
  [
    "the no-JS form's DOM order",
    "?kind=song&term=war&q=kettle&stub=false&status=endangered",
    "?q=kettle&term=war&kind=song&status=endangered&stub=false",
    200,
  ],
  // Rule 10: compared decoded.
  ["~ written raw", "?q=a~b", "?q=a%7Eb", 200],
  ["~ percent-encoded", "?q=a%7Eb", "?q=a%7Eb", 200],
  ["an apostrophe percent-encoded", "?q=it%27s", "?q=it%27s", 200],
  ["an apostrophe raw", "?q=it's", "?q=it%27s", 200],
  ["a space as %20", "?q=a%20b", "?q=a+b", 200],
  ["lower-case percent hex", "?q=%c3%a9", "?q=%C3%A9", 200],
  ["a name percent-encoded", "?%6Cetter=T", "?letter=T", 200],
];

describe("pieceQuery canonical form (plan §2.2)", () => {
  it("has at least 60 cases", () => {
    expect(TABLE.length).toBeGreaterThanOrEqual(60);
  });

  it.each(TABLE)("%s: %s → %s (%d)", (_why, search, canonical, answer) => {
    expect(parse(search).canonical).toBe(canonical);
    expect(redirectFor(search)).toBe(
      answer === 301 ? `/pieces${canonical}` : null
    );
  });

  it.each(TABLE)(
    "%s: the canonical form is answered 200, so a redirect never loops",
    (_why, search) => {
      const { canonical, state } = parse(search);
      expect(redirectFor(canonical)).toBeNull();
      expect(parse(canonical).state).toEqual(state);
    }
  );

  it.each(TABLE)("%s: href gives back the canonical form", (_why, search) => {
    const { canonical, state } = parse(search);
    // href resets the page unless told the page, so it is passed on.
    expect(pieceQuery.href(state, { page: state.page })).toBe(
      `/pieces${canonical}`
    );
  });
});

describe("pieceQuery.parse", () => {
  it("parses every value", () => {
    expect(
      parse(
        "?q=kettle&term=eerie&kind=poem&status=endangered&stub=false&letter=K&sort=title&page=4"
      ).state
    ).toEqual({
      q: "kettle",
      term: ["eerie"],
      kind: ["poem"],
      status: ["endangered"],
      stub: false,
      letter: "K",
      sort: "title",
      page: 4,
    });
  });

  it("is the whole list for no query", () => {
    expect(parse("").state).toEqual(EMPTY);
  });
});

describe("pieceQuery.href", () => {
  const state = parse("?q=kettle&kind=song&letter=K&sort=title&page=3").state;

  it("resets the page for any change but the page", () => {
    expect(pieceQuery.href(state, { letter: "T" })).toBe(
      "/pieces?q=kettle&kind=song&letter=T&sort=title"
    );
    expect(pieceQuery.href(state)).toBe(
      "/pieces?q=kettle&kind=song&letter=K&sort=title"
    );
  });

  it("keeps the rest for a page change, and drops page 1", () => {
    expect(pieceQuery.href(state, { page: 4 })).toBe(
      "/pieces?q=kettle&kind=song&letter=K&sort=title&page=4"
    );
    expect(pieceQuery.href(state, { page: 1 })).toBe(
      "/pieces?q=kettle&kind=song&letter=K&sort=title"
    );
  });

  it("drops what a change makes moot: no search, no order", () => {
    expect(pieceQuery.href(state, { q: undefined })).toBe(
      "/pieces?kind=song&letter=K"
    );
  });

  it("is /pieces with nothing set", () => {
    expect(pieceQuery.href(EMPTY)).toBe("/pieces");
  });

  it.each([
    { ...EMPTY, q: "Þorvald’s lament" },
    { ...EMPTY, term: ["eerie", "war"], kind: ["song", "comedy"] as const },
    { ...EMPTY, status: ["low_risk"] as const, stub: true },
    { ...EMPTY, letter: "0" as const, page: 7 },
    { ...EMPTY, q: "a+b & c=d", sort: "title" as const },
  ])("round-trips %o", s => {
    const href = pieceQuery.href(s, { page: s.page });
    expect(parse(href.slice("/pieces".length)).state).toEqual(s);
  });
});

describe("pieceQuery.toApi", () => {
  it("names the API's parameters and computes the offset", () => {
    expect(
      pieceQuery.toApi(
        parse(
          "?q=kettle&term=eerie&kind=poem&status=endangered&stub=false&letter=K&sort=title&page=3"
        ).state
      )
    ).toEqual({
      q: "kettle",
      term: ["eerie"],
      kind: ["poem"],
      conservation_status: ["endangered"],
      stub: false,
      letter: "K",
      sort: "title",
      limit: 50,
      offset: 100,
    });
  });

  it("sends only paging for the whole list", () => {
    expect(pieceQuery.toApi(EMPTY)).toEqual({ limit: 50, offset: 0 });
  });

  it("reaches offset 10000 on the last page the API serves", () => {
    expect(pieceQuery.toApi({ ...EMPTY, page: 201 }).offset).toBe(10_000);
  });
});

// ---------------------------------------------------------------------------
// Track C

describe("categoryIndexQuery (plan §4.8)", () => {
  const parseIndex = (search: string) =>
    categoryIndexQuery.parse(new URLSearchParams(search));

  it.each([
    ["", undefined, ""],
    ["?facet=mood", "mood", "?facet=mood"],
    ["?facet=Affiliation", "affiliation", "?facet=affiliation"],
    // The two piece fields the index shows as sections of their own.
    ["?facet=kind", "kind", "?facet=kind"],
    ["?facet=conservation", "conservation", "?facet=conservation"],
    // An invalid facet is dropped; the first valid one of a repeat wins.
    ["?facet=genre", undefined, ""],
    ["?facet=genre&facet=topic&facet=form", "topic", "?facet=topic"],
    ["?facet=", undefined, ""],
    ["?utm_source=mail&facet=origin", "origin", "?facet=origin"],
  ] as const)("reads %j", (search, facet, canonical) => {
    expect(parseIndex(search)).toEqual({ state: { facet }, canonical });
  });

  it("links to a section, or to the whole index", () => {
    expect(categoryIndexQuery.href("mood")).toBe("/categories?facet=mood");
    expect(categoryIndexQuery.href(undefined)).toBe("/categories");
  });

  it("is canonical for every href it makes", () => {
    for (const facet of ["kind", "other", "conservation", undefined] as const) {
      const href = categoryIndexQuery.href(facet);
      const search = href.slice("/categories".length);
      expect(parseIndex(search).canonical).toBe(search);
    }
  });
});

describe("termMembersQuery (plan §4.8)", () => {
  const parsePage = (search: string) =>
    termMembersQuery.parse(new URLSearchParams(search));

  it.each([
    ["", 1, ""],
    ["?page=2", 2, "?page=2"],
    ["?page=1", 1, ""],
    ["?page=0", 1, ""],
    ["?page=02", 1, ""],
    ["?page=x&page=3", 3, "?page=3"],
    ["?offset=50", 1, ""],
  ] as const)("reads %j", (search, page, canonical) => {
    expect(parsePage(search)).toEqual({ state: { page }, canonical });
  });

  it("asks for 50 members from the page's offset", () => {
    expect(termMembersQuery.toApi({ page: 1 })).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(termMembersQuery.toApi({ page: 3 })).toEqual({
      limit: 50,
      offset: 100,
    });
  });

  it("links to a page under the entity's path", () => {
    expect(termMembersQuery.href("/categories/joyful", 2)).toBe(
      "/categories/joyful?page=2"
    );
    expect(termMembersQuery.href("/categories/joyful", 1)).toBe(
      "/categories/joyful"
    );
  });
});

describe("collectionQuery (plan §4.9)", () => {
  const parseCollections = (search: string) =>
    collectionQuery.parse(new URLSearchParams(search));

  it.each([
    ["", ""],
    ["?kind=wiki&kind=blog", "?kind=wiki&kind=blog"],
    // Enum order, lower-cased, de-duplicated, invalid dropped.
    ["?kind=blog&kind=WIKI&kind=wiki&kind=zine", "?kind=wiki&kind=blog"],
    ["?letter=n", "?letter=N"],
    ["?letter=0", "?letter=0"],
    ["?letter=%C3%A9", ""],
    ["?page=2&kind=other", "?kind=other&page=2"],
    ["?page=1", ""],
    ["?q=songs", ""],
  ])("reads %j as %j", (search, canonical) => {
    expect(parseCollections(search).canonical).toBe(canonical);
    // The canonical form is canonical itself.
    expect(parseCollections(canonical).canonical).toBe(canonical);
  });

  it("asks the API for the kinds, the letter and the page", () => {
    const { state } = parseCollections("?kind=blog&letter=C&page=3");
    expect(collectionQuery.toApi(state)).toEqual({
      kind: ["blog"],
      letter: "C",
      limit: 50,
      offset: 100,
    });
    expect(collectionQuery.toApi(parseCollections("").state)).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it("resets the page on a change unless the change is the page", () => {
    const { state } = parseCollections("?kind=blog&page=3");
    expect(collectionQuery.href(state, { letter: "B" })).toBe(
      "/collections?kind=blog&letter=B"
    );
    expect(collectionQuery.href(state, { page: 4 })).toBe(
      "/collections?kind=blog&page=4"
    );
    expect(collectionQuery.href(state, { kind: [] })).toBe("/collections");
  });
});

describe("eventQuery (plan §4.10)", () => {
  const parseEvents = (search: string) =>
    eventQuery.parse(new URLSearchParams(search));

  it.each([
    ["", ""],
    ["?kind=venue", "?kind=venue"],
    ["?kind=Venue", "?kind=venue"],
    ["?kind=tavern", ""],
    ["?kind=tavern&kind=event", "?kind=event"],
    ["?kind=event&kind=venue", "?kind=event"],
    ["?page=2&kind=venue", "?kind=venue&page=2"],
    ["?letter=M", ""],
  ])("reads %j as %j", (search, canonical) => {
    expect(parseEvents(search).canonical).toBe(canonical);
    expect(parseEvents(canonical).canonical).toBe(canonical);
  });

  it("asks the API for the kind and the page", () => {
    expect(eventQuery.toApi(parseEvents("?kind=venue&page=2").state)).toEqual({
      kind: "venue",
      limit: 50,
      offset: 50,
    });
  });

  it("switches kind from page 1", () => {
    const { state } = parseEvents("?kind=venue&page=2");
    expect(eventQuery.href(state, { kind: "event" })).toBe(
      "/events?kind=event"
    );
    expect(eventQuery.href(state, { kind: undefined })).toBe("/events");
  });
});

describe("historyQuery (plan §4.11)", () => {
  it("pages a history like any page-only list", () => {
    expect(historyQuery.parse(new URLSearchParams("?page=3&x=1"))).toEqual({
      state: { page: 3 },
      canonical: "?page=3",
    });
    expect(historyQuery.toApi({ page: 2 })).toEqual({ limit: 50, offset: 50 });
    expect(historyQuery.href("/events/x/history", 2)).toBe(
      "/events/x/history?page=2"
    );
  });
});
