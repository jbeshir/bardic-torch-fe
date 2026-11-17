import { describe, expect, it } from "vitest";
import {
  categoryIndexQuery,
  collectionQuery,
  eventQuery,
  historyQuery,
  personQuery,
  pieceQuery,
  redirectIfNotCanonical,
  searchQuery,
  termMembersQuery,
} from "./query-state";

const parsers = {
  pieces: pieceQuery,
  bards: personQuery,
  categories: categoryIndexQuery,
  members: termMembersQuery,
  collections: collectionQuery,
  events: eventQuery,
  search: searchQuery,
  history: historyQuery,
} as const;

/**
 * Plan §2.2: a request's query and its canonical form, across the list
 * pages. Anything that differs is answered with one 301 to the canonical.
 */
const TABLE: readonly (readonly [
  why: string,
  page: keyof typeof parsers,
  query: string,
  canonical: string,
])[] = [
  ["no query", "pieces", "", ""],
  [
    "every piece parameter, in order",
    "pieces",
    "?q=kettle&term=eerie&term=war&kind=song&kind=poem&status=low_risk&stub=true&letter=W&sort=title&page=3",
    "?q=kettle&term=eerie&term=war&kind=song&kind=poem&status=low_risk&stub=true&letter=W&sort=title&page=3",
  ],
  [
    "terms sorted, duplicates dropped",
    "pieces",
    "?term=war&term=eerie&term=war",
    "?term=eerie&term=war",
  ],
  [
    "kinds in enum order",
    "pieces",
    "?kind=poem&kind=song",
    "?kind=song&kind=poem",
  ],
  ["an enum value in the wrong case is invalid", "pieces", "?kind=Song", ""],
  ["a lower-case letter is upper-cased", "pieces", "?letter=t", "?letter=T"],
  [
    "a search is trimmed, its case and length kept",
    "pieces",
    `?q=%20Kettle${"a".repeat(300)}%0A`,
    `?q=Kettle${"a".repeat(300)}`,
  ],
  [
    "an old stub=false is the default, stubs left out",
    "pieces",
    "?stub=false",
    "",
  ],
  ["every page", "pieces", "?stub=all", "?stub=all"],
  ["an order the search makes moot", "pieces", "?sort=title", ""],
  [
    "bards: filters, affiliation and order",
    "bards",
    "?q=heron&kind=group&role=singer&affiliation=northmarch&sort=name&page=2",
    "?q=heron&kind=group&role=singer&affiliation=northmarch&sort=name&page=2",
  ],
  ["bards: every page", "bards", "?stub=all", "?stub=all"],
  ["bards: no stubs-only list", "bards", "?stub=true", ""],
  ["categories: one section", "categories", "?facet=kind", "?facet=kind"],
  [
    "collections: kinds and letter",
    "collections",
    "?kind=songbook_pdf&letter=a",
    "?kind=songbook_pdf&letter=A",
  ],
  ["search: only q", "search", "?q=kettle&page=2", "?q=kettle"],
];

describe("query state", () => {
  it.each(TABLE)("%s", (_why, page, query, canonical) => {
    expect(parsers[page].parse(new URLSearchParams(query)).canonical).toBe(
      canonical
    );
  });

  it("answers any other query with one 301 to the canonical form, and an order-only difference as it is", () => {
    const redirect = (search: string) => {
      const { canonical } = pieceQuery.parse(new URLSearchParams(search));
      try {
        redirectIfNotCanonical(
          new URL(`https://app.test/pieces${search}`),
          canonical
        );
        return null;
      } catch (thrown) {
        if (!(thrown instanceof Response)) throw thrown;
        return [thrown.status, thrown.headers.get("Location")];
      }
    };
    expect(redirect("?kind=Song&page=1")).toEqual([301, "/pieces"]);
    expect(redirect("?q=&kind=song")).toEqual([301, "/pieces?kind=song"]);
    expect(redirect("?letter=T&kind=song")).toBeNull();
    expect(redirect("?q=kettle&kind=song&kind=poem")).toBeNull();
  });

  it("links a change from page 1, and drops an order a change makes moot", () => {
    const { state } = pieceQuery.parse(
      new URLSearchParams("?q=kettle&sort=title&page=3")
    );
    expect(pieceQuery.href(state, { kind: ["song"] })).toBe(
      "/pieces?q=kettle&kind=song&sort=title"
    );
    expect(pieceQuery.href(state, { page: 4 })).toBe(
      "/pieces?q=kettle&sort=title&page=4"
    );
    expect(pieceQuery.href(state, { q: undefined })).toBe("/pieces");
    expect(pieceQuery.toApi(state)).toMatchObject({
      q: "kettle",
      sort: "title",
      limit: 50,
      offset: 100,
    });
  });

  it("asks the API for no stubs by default, and for every page with stub=all", () => {
    const pieces = (search: string) =>
      pieceQuery.toApi(pieceQuery.parse(new URLSearchParams(search)).state);
    const bards = (search: string) =>
      personQuery.toApi(personQuery.parse(new URLSearchParams(search)).state);
    expect(pieces("")).toMatchObject({ stub: false });
    expect(pieces("?stub=true")).toMatchObject({ stub: true });
    expect(pieces("?stub=all")).not.toHaveProperty("stub");
    expect(bards("")).toMatchObject({ stub: false });
    expect(bards("?stub=all")).not.toHaveProperty("stub");
  });
});
