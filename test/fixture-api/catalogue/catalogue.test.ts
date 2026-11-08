import { describe, expect, it } from "vitest";
import type { components } from "../../../app/api/schema.gen";
import { createFixtureState, handleFixtureRequest } from "../router";
import { responseProblems } from "../spec";
import {
  COLLECTIONS,
  DRILL_BOOK_ID,
  NORTHMARCH_SONGBOOK_ID,
} from "./collections";
import { EVENTS, MIDWINTER_REVEL_SLUG, MUSTER_FIELD_SLUG } from "./events";
import { DRILL_BARD_SLUG } from "./generated";
import { PERSONS } from "./persons";
import { PIECES } from "./pieces";
import { REVISIONS, UNAPPROVED_REVISIONS } from "./revisions";
import {
  DRAFT_CHILD_SLUG,
  DRAFT_TOPIC_SLUG,
  EMPTY_ROOT_SLUG,
  TERMS,
} from "./terms";
import {
  compareSortKeys,
  fold,
  letterOf,
  parseSearch,
  titleSortKey,
} from "./text";

/**
 * The fixture's catalogue semantics, through the router (so every body is
 * also validated against the spec): facets, counts, letters, search, sort
 * keys, visibility, caps and revisions. Expectations are worked out by hand
 * from the data files, not read back from the fixture.
 */

type Schemas = components["schemas"];

const state = createFixtureState();

function get(path: string) {
  const { pathname, search } = new URL(path, "http://fixture.invalid");
  return handleFixtureRequest(state, {
    method: "GET",
    pathname,
    search,
    authorization: null,
    contentType: null,
    body: "",
  });
}

function ok<T>(path: string): T {
  const response = get(path);
  expect(response.status, path).toBe(200);
  return response.body as T;
}

const pieces = (path: string) => ok<Schemas["PieceList"]>(path);
const slugs = (list: { data: readonly { slug: string }[] }) =>
  list.data.map(entry => entry.slug);

describe("text rules", () => {
  it("skips leading punctuation and one leading The, A or An for titles", () => {
    expect(titleSortKey("The Ashdown Wassail")).toBe("Ashdown Wassail");
    expect(titleSortKey("A Fair Wind from Caer Wyn")).toBe(
      "Fair Wind from Caer Wyn"
    );
    expect(titleSortKey("¿Dónde Está?")).toBe("Dónde Está?");
    expect(titleSortKey("The The")).toBe("The");
    expect(titleSortKey("Theodora")).toBe("Theodora");
  });

  it.each([
    ["1588 Armada Ballad", "0"],
    ["2nd Northmarch Songbook", "0"],
    ["Dónde Está?", "D"],
    ["Þorvald’s Lament", "T"],
    ["Łukasz", "L"],
    ["Øystein", "O"],
    ["Ðorvi", "D"],
    ["Æthel", "A"],
    ["Œuvre", "O"],
    ["ﬁddle", "F"],
    ["éclair", "E"],
    ["Ἀχιλλεύς", "0"],
    ["", "0"],
  ])("files %s under %s", (key, letter) => {
    expect(letterOf(key)).toBe(letter);
  });

  it("folds accents, case and the letters NFKD leaves whole", () => {
    expect(fold("Þorvald’s Æsir Straße Łódź Øre")).toBe(
      "thorvald’s aesir strasse lodz ore"
    );
  });

  it("orders sort keys ignoring accents, case and punctuation", () => {
    const keys = ["Tinker’s Jig", "tam lin", "Þorvald", "Tavern Round"];
    expect([...keys].sort(compareSortKeys)).toEqual([
      "tam lin",
      "Tavern Round",
      "Þorvald",
      "Tinker’s Jig",
    ]);
    expect(compareSortKeys("Dónde", "donde")).toBe(0);
  });

  it.each([
    ["rock and roll", ["rock", "and", "roll"]],
    ["song from the hills", ["song", "hills"]],
    ["+copper -kettle*", ["copper", "kettle"]],
    ["Þorvald’s", ["thorvald"]],
    ["dóndé", ["donde"]],
    ["a1_b ab", ["a1_b"]],
    [
      "one two three four five six seven eight nine",
      ["one", "two", "three", "four", "five", "six", "seven", "eight"],
    ],
  ])("tokenises %j", (q, tokens) => {
    expect(parseSearch(q)).toEqual({ kind: "words", tokens });
  });

  it("keeps tokens of 3 to 84 characters only", () => {
    expect(parseSearch(`ab ${"x".repeat(84)}`)).toEqual({
      kind: "words",
      tokens: ["x".repeat(84)],
    });
    expect(parseSearch(`${"x".repeat(85)} ab`)).toEqual({
      kind: "prefix",
      prefix: `${"x".repeat(85)} ab`,
    });
  });

  it.each(["the", "Oi", "of the", "___", "a an"])(
    "falls back to a prefix match for %j",
    q => {
      expect(parseSearch(q)).toEqual({ kind: "prefix", prefix: fold(q) });
    }
  );
});

describe("faceted piece search", () => {
  it("lists every piece by sort title, 50 at a time, with a stable total", () => {
    const first = pieces("/v1/pieces");
    expect(first.total).toBe(PIECES.length);
    expect(first.data).toHaveLength(50);
    expect(slugs(first).slice(0, 3)).toEqual([
      "1588-armada-ballad",
      "the-ashdown-wassail",
      "ballad-of-the-broken-banner",
    ]);
    const pages = [0, 50, 100, 150, 200].flatMap(offset =>
      slugs(pieces(`/v1/pieces?offset=${offset}`))
    );
    expect(new Set(pages).size).toBe(PIECES.length);
    expect(pieces("/v1/pieces?offset=10000").data).toEqual([]);
  });

  it("ORs terms within a facet", () => {
    expect(pieces("/v1/pieces?term=eerie&term=comedic").total).toBe(6);
  });

  it("ANDs terms across facets", () => {
    expect(slugs(pieces("/v1/pieces?term=eerie&term=death"))).toEqual([
      "harvest-of-ravens",
      "the-weeping-harper",
    ]);
  });

  it("matches descendants, counting a piece tagged with a term and its child once", () => {
    expect(slugs(pieces("/v1/pieces?term=war"))).toEqual([
      "1588-armada-ballad",
      "ballad-of-the-broken-banner",
      "bold-sir-aldric",
      "the-dragons-hoard",
      "fields-of-thorn",
    ]);
    expect(pieces("/v1/pieces?term=battles").total).toBe(3);
    expect(pieces("/v1/pieces?term=contrafacta").total).toBe(3);
    expect(
      pieces("/v1/pieces").facets.terms.find(t => t.slug === "war")
    ).toEqual({ slug: "war", count: 5 });
  });

  it("counts a repeated term once", () => {
    expect(pieces("/v1/pieces?term=war&term=war").total).toBe(5);
  });

  it("matches a kind as primary or secondary", () => {
    expect(slugs(pieces("/v1/pieces?kind=story&term=eerie"))).toEqual([
      "the-weeping-harper",
    ]);
  });

  it("filters on stub, letter and conservation status", () => {
    expect(slugs(pieces("/v1/pieces?stub=true"))).toEqual([
      "the-unfinished-lay",
    ]);
    expect(pieces("/v1/pieces?stub=false").total).toBe(PIECES.length - 1);
    expect(slugs(pieces("/v1/pieces?conservation_status=restricted"))).toEqual([
      "the-dragons-hoard",
      "the-silent-reel",
    ]);
  });

  it("computes disjunctive counts: each facet ignores its own selection", () => {
    const list = pieces("/v1/pieces?term=eerie&kind=poem");
    expect(slugs(list)).toEqual([
      "the-dragons-hoard",
      "harvest-of-ravens",
      "the-weeping-harper",
    ]);
    expect(list.total).toBe(3);
    expect(list.facets).toEqual({
      // Moods count every poem; other facets count the 3 eerie poems.
      terms: [
        { slug: "death", count: 2 },
        { slug: "eerie", count: 3 },
        { slug: "relaxed", count: 1 },
        { slug: "sca-pieces", count: 3 },
        { slug: "tragic", count: 1 },
        { slug: "war", count: 1 },
      ],
      // Every eerie piece, by kind.
      kinds: [
        { kind: "poem", count: 3 },
        { kind: "story", count: 1 },
      ],
      conservation_statuses: [
        { conservation_status: "endangered", count: 1 },
        { conservation_status: "critically_endangered", count: 1 },
        { conservation_status: "restricted", count: 1 },
      ],
      letters: [
        { letter: "D", count: 1 },
        { letter: "H", count: 1 },
        { letter: "W", count: 1 },
      ],
    });
  });

  it("lists only counts above zero, terms by slug, enums in their order", () => {
    const { facets } = pieces("/v1/pieces");
    const termSlugs = facets.terms.map(t => t.slug);
    expect(termSlugs).toEqual([...termSlugs].sort());
    expect(facets.terms.every(t => t.count > 0)).toBe(true);
    expect(termSlugs).not.toContain(EMPTY_ROOT_SLUG);
    expect(termSlugs).not.toContain(DRAFT_TOPIC_SLUG);
    expect(termSlugs).not.toContain("northmarch");
    expect(facets.kinds.map(k => k.kind)).toEqual([
      "song",
      "poem",
      "story",
      "dance_music",
      "instrumental",
      "comedy",
    ]);
    expect(
      facets.conservation_statuses.map(s => s.conservation_status)
    ).toEqual([
      "unassessed",
      "low_risk",
      "endangered",
      "critically_endangered",
      "restricted",
    ]);
  });

  it("files letters 0 first and ignores the letter filter for them", () => {
    const all = pieces("/v1/pieces").facets.letters;
    expect(all[0]).toEqual({ letter: "0", count: 1 });
    expect(all.map(l => l.letter)).not.toEqual(
      expect.arrayContaining(["Q", "X", "Z"])
    );
    const t = pieces("/v1/pieces?letter=T");
    expect(t.facets.letters).toEqual(all);
    expect(slugs(t)).toEqual([
      "tam-lins-daughter",
      "tavern-round",
      "thorvalds-lament",
      "the-tinkers-jig",
      "twelve-candles",
    ]);
    expect(slugs(pieces("/v1/pieces?letter=A"))).toEqual([
      "the-ashdown-wassail",
    ]);
    const d = pieces("/v1/pieces?letter=D");
    expect(d.total).toBe(208);
    expect(slugs(d).slice(0, 4)).toEqual([
      "dance-of-the-nine-candles",
      "donde-esta",
      "the-dragons-hoard",
      "drill-song-001",
    ]);
  });

  it.each([
    ["an unknown term", "no-such-term"],
    ["an unapproved term", DRAFT_TOPIC_SLUG],
    ["a term under an unapproved one", DRAFT_CHILD_SLUG],
    ["an affiliation", "northmarch"],
  ])("answers 400 unknown term for %s", (_label, slug) => {
    expect(get(`/v1/pieces?term=${slug}`)).toEqual({
      status: 400,
      body: { code: "invalid_request", message: `unknown term: ${slug}` },
    });
  });
});

describe("search", () => {
  const q = (query: string, extra = "") =>
    slugs(pieces(`/v1/pieces?q=${encodeURIComponent(query)}${extra}`));

  it("needs every word to start a word, ignoring case, accents and operators", () => {
    expect(q("kettle")).toEqual(["the-copper-kettle", "kettle-and-tongs"]);
    expect(q("ket")).toEqual(["the-copper-kettle", "kettle-and-tongs"]);
    expect(q("ettle")).toEqual([]);
    expect(q("+copper -kettle")).toEqual(["the-copper-kettle"]);
    expect(q("DONDE")).toEqual(["donde-esta"]);
    expect(q("cancao")).toEqual(["cancao-do-mar"]);
    expect(q("thorvald")).toEqual(["thorvalds-lament"]);
  });

  it("drops stopwords but keeps “and”", () => {
    expect(q("the copper")).toEqual(["the-copper-kettle"]);
    expect(q("kettle and tongs")).toEqual(["kettle-and-tongs"]);
    expect(q("rock and roll")).toEqual([]);
  });

  it("ignores words under 3 or over 84 characters", () => {
    expect(q(`copper ${"a".repeat(85)}`)).toEqual(["the-copper-kettle"]);
    expect(q(`copper ${"a".repeat(84)}`)).toEqual([]);
  });

  it("falls back to a title prefix match when no word counts, in sort-key order", () => {
    expect(q("ke")).toEqual(["kettle-and-tongs"]);
    expect(q("of the")).toEqual([]);
    expect(q("the")).toEqual([
      "the-ashdown-wassail",
      "the-copper-kettle",
      "the-dragons-hoard",
      "the-long-road-north",
      "the-silent-reel",
      "the-tinkers-jig",
      "the-unfinished-lay",
      "the-weeping-harper",
    ]);
  });

  it("matches aliases and notes, ranking titles above aliases above notes", () => {
    expect(q("tavern favourite")).toEqual(["the-copper-kettle"]);
    expect(q("narrative")).toEqual(["the-dragons-hoard"]);
    expect(q("old")).toEqual(["old-man-of-the-marsh", "the-copper-kettle"]);
    expect(q("old", "&sort=title")).toEqual([
      "the-copper-kettle",
      "old-man-of-the-marsh",
    ]);
  });

  it("is a plain AND filter with the facets", () => {
    expect(q("harper", "&kind=poem")).toEqual(["the-weeping-harper"]);
  });
});

describe("persons", () => {
  const persons = (path: string) => ok<Schemas["PersonList"]>(path);

  it("lists everyone by sort key (no leading The, A or An), a no-page person as a stub", () => {
    const list = persons("/v1/persons");
    expect(list.total).toBe(PERSONS.length);
    expect(list.data.find(p => p.slug === "hollis-fenn")).toEqual({
      slug: "hollis-fenn",
      name: "Hollis Fenn",
      kind: "community_bard",
      is_stub: true,
    });
    expect(slugs(list).slice(-3)).toEqual([
      "tamsin-of-the-reeds",
      "wren-of-the-vale",
      "wynne-of-caer-wyn",
    ]);
    expect(slugs(persons("/v1/persons?letter=W"))).toEqual([
      "wren-of-the-vale",
      "wynne-of-caer-wyn",
    ]);
    expect(persons("/v1/persons?letter=W").letters).toEqual(list.letters);
    expect(list.letters.find(l => l.letter === "T")).toEqual({
      letter: "T",
      count: 1,
    });
    expect(slugs(persons("/v1/persons?letter=G"))).toContain(
      "the-greywater-minstrels"
    );
    expect(slugs(persons("/v1/persons?letter=T"))).not.toContain(
      "the-greywater-minstrels"
    );
  });

  it("matches public aliases, never hidden ones, and no-page persons by name only", () => {
    expect(slugs(persons("/v1/persons?q=sparrow"))).toEqual([
      "wren-of-the-vale",
    ]);
    expect(persons("/v1/persons?q=hidden").total).toBe(0);
    expect(persons("/v1/persons?q=legal").total).toBe(0);
    expect(slugs(persons("/v1/persons?q=hollis"))).toEqual(["hollis-fenn"]);
  });

  it("filters roles and affiliations (with descendants) among persons with a page", () => {
    expect(slugs(persons("/v1/persons?affiliation=northmarch"))).toEqual([
      "aldith-of-ashdown",
      "brannoc-the-drillmaster",
      "northmarch-bards",
      "wren-of-the-vale",
    ]);
    expect(slugs(persons("/v1/persons?role=dancer"))).toEqual([
      "tamsin-of-the-reeds",
    ]);
    // "The Greywater Minstrels" sorts, and counts, under G.
    expect(slugs(persons("/v1/persons?kind=group"))).toEqual([
      "the-greywater-minstrels",
      "northmarch-bards",
    ]);
  });
});

describe("piece pages", () => {
  const piece = (slug: string) => ok<Schemas["Piece"]>(`/v1/pieces/${slug}`);

  it("orders terms by facet then position, and relations by direction then type", () => {
    const kettle = piece("the-copper-kettle");
    expect(kettle.terms.map(t => t.term.slug)).toEqual([
      "joyful",
      "singalong",
      "drinking",
      "english",
      "ballad",
      "traditional-and-folk",
    ]);
    expect(kettle.relations).toEqual([
      expect.objectContaining({
        type: "variant_of",
        direction: "incoming",
        piece: expect.objectContaining({ slug: "kettle-and-tongs" }),
      }),
      expect.objectContaining({
        type: "contrafactum_of",
        direction: "incoming",
        piece: expect.objectContaining({ slug: "filk-of-the-fallen-cake" }),
      }),
    ]);
    expect(piece("kettle-and-tongs").relations).toEqual([
      expect.objectContaining({ type: "variant_of", direction: "outgoing" }),
    ]);
  });

  it("drops a no-page person's credit whole, and their performances' mention", () => {
    const wassail = piece("the-ashdown-wassail");
    expect(wassail.credits).toEqual([
      {
        role: "tune",
        attribution: "traditional",
        certainty: "certain",
        part: "tune",
        note: null,
        person: null,
      },
    ]);
    const performers = wassail.links.flatMap(l =>
      l.performances.flatMap(p => p.performers.map(x => x.slug))
    );
    expect(performers).toEqual(["aldith-of-ashdown"]);
    expect(
      piece("northmarch-rising").links[0]?.performances[0]?.performers
    ).toEqual([]);
  });

  it("never serves a hidden link", () => {
    const kettle = piece("the-copper-kettle");
    expect(kettle.links).toHaveLength(3);
    expect(JSON.stringify(kettle)).not.toContain("HIDDEN-");
  });

  it("sets a credit's person exactly when it is named", () => {
    for (const { slug } of PIECES) {
      for (const credit of piece(slug).credits) {
        expect(credit.person !== null, slug).toBe(
          credit.attribution === "named"
        );
      }
    }
  });

  it("answers 404 for an unknown piece", () => {
    expect(get("/v1/pieces/no-such-piece")).toEqual({
      status: 404,
      body: { code: "not_found", message: "piece not found" },
    });
  });
});

describe("person pages", () => {
  const person = (slug: string) => ok<Schemas["Person"]>(`/v1/persons/${slug}`);

  it("shows a no-page person by identity only", () => {
    expect(person("hollis-fenn")).toEqual({
      slug: "hollis-fenn",
      name: "Hollis Fenn",
      kind: "community_bard",
      is_stub: true,
      status: "prefers_no_page",
      status_date: "2026-03-01",
      status_source_url: "https://requests.example/statements/12",
      profile: null,
    });
  });

  it("shows public aliases, roles in enum order, relations, works and performances", () => {
    const profile = person("wren-of-the-vale").profile;
    expect(profile?.aliases).toEqual([
      { name: "Wren Vale-Singer", kind: "sca" },
      { name: "The Vale Sparrow", kind: "stage" },
    ]);
    expect(profile?.roles).toEqual(["singer", "songwriter", "storyteller"]);
    expect(
      profile?.relations.map(r => [r.type, r.direction, r.person.slug])
    ).toEqual([
      ["member_of", "outgoing", "northmarch-bards"],
      ["heir_of", "incoming", "dafydd-pennar"],
    ]);
    expect(profile?.works.map(w => [w.piece.slug, w.role])).toEqual([
      ["the-copper-kettle", "tune"],
      ["the-dragons-hoard", "author"],
      ["midwinter-carol", "lyrics"],
    ]);
    expect(profile?.performances.map(p => [p.year, p.link.url])).toEqual([
      [2026, "https://private-recordings.example/hoard/recording"],
      [2025, "https://video.example/watch/kettle-hearth"],
      [2025, "https://private-recordings.example/hoard/revel"],
      [2025, "https://video.example/watch/carol"],
    ]);
    expect(profile?.performances_total).toBe(4);
    expect(profile?.links.map(l => l.roles)).toEqual([
      ["website"],
      ["external_profile"],
    ]);
  });

  it("caps works and performances at 200, with totals", () => {
    const profile = person(DRILL_BARD_SLUG).profile;
    expect(profile?.works).toHaveLength(200);
    expect(profile?.works_total).toBe(205);
    expect(profile?.performances).toHaveLength(200);
    expect(profile?.performances_total).toBe(202);
  });

  it("lists a group's members as incoming relations", () => {
    expect(
      person("northmarch-bards").profile?.relations.map(r => r.person.slug)
    ).toEqual(["aldith-of-ashdown", "wren-of-the-vale"]);
  });
});

describe("terms", () => {
  const terms = (path: string) => ok<Schemas["TermList"]>(path).data;
  const term = (slug: string, extra = "") =>
    ok<Schemas["Term"]>(`/v1/terms/${slug}${extra}`);

  it("lists public terms in tree order, with distinct counts", () => {
    const all = terms("/v1/terms");
    const order = all.map(t => t.slug);
    expect(order).not.toContain(DRAFT_TOPIC_SLUG);
    expect(order).not.toContain(DRAFT_CHILD_SLUG);
    expect(all).toHaveLength(TERMS.length - 2);
    expect(
      all
        .filter(t => t.facet === "topic")
        .map(t => t.slug)
        .slice(0, 6)
    ).toEqual([
      "war",
      "battles",
      "swords",
      "sca",
      "sca-peerage-pieces",
      "squires",
    ]);
    expect(all.find(t => t.slug === "war")).toMatchObject({
      piece_count: 5,
      person_count: 0,
      parent_slug: null,
    });
    expect(all.find(t => t.slug === EMPTY_ROOT_SLUG)).toMatchObject({
      piece_count: 0,
      person_count: 0,
    });
    expect(
      all
        .filter(t => t.facet === "affiliation")
        .map(t => [t.slug, t.person_count])
    ).toEqual([
      ["northmarch", 4],
      ["barony-of-ashdown", 2],
      ["westerfell", 2],
      ["shire-of-greywater", 1],
      ["caer-wyn", 2],
    ]);
  });

  it("lists one facet's terms", () => {
    expect(terms("/v1/terms?facet=origin").map(t => t.slug)).toEqual([
      "sca-pieces",
      "traditional-and-folk",
      "pre-1600-sources",
      "contrafacta",
      "contrafacta-modern",
      "contrafacta-sca",
      "12th-century",
      "13th-century",
      "16th-century",
      "18th-century",
      "20th-century",
    ]);
  });

  it("shows a term's ancestors, children, members and related affiliation", () => {
    const swords = term("swords");
    expect(swords.ancestors.map(t => t.slug)).toEqual(["war", "battles"]);
    expect(swords.pieces.map(p => p.slug)).toEqual([
      "bold-sir-aldric",
      "fields-of-thorn",
    ]);
    expect(swords.piece_count).toBe(2);
    expect(term("battles").children).toEqual([
      {
        term: { slug: "swords", facet: "topic", display_name: "Swords" },
        piece_count: 2,
        person_count: 0,
      },
    ]);
    expect(term("sca-peerage-pieces").related_affiliation?.slug).toBe(
      "northmarch"
    );
    const northmarch = term("northmarch");
    expect(northmarch.pieces).toEqual([]);
    expect(northmarch.persons.map(p => p.slug)).toEqual([
      "aldith-of-ashdown",
      "brannoc-the-drillmaster",
      "northmarch-bards",
      "wren-of-the-vale",
    ]);
  });

  it("pages a term's members", () => {
    const count = term("sca-pieces").piece_count;
    expect(count).toBeGreaterThan(205);
    expect(term("sca-pieces", "?limit=10&offset=5").pieces).toHaveLength(10);
    expect(term("sca-pieces", `?offset=${count - 1}`).pieces).toHaveLength(1);
  });

  it.each([DRAFT_TOPIC_SLUG, DRAFT_CHILD_SLUG, "no-such-term"])(
    "answers 404 for %s",
    slug => {
      expect(get(`/v1/terms/${slug}`)).toEqual({
        status: 404,
        body: { code: "not_found", message: "term not found" },
      });
    }
  );
});

describe("collections and events", () => {
  it("lists collections by sort name, a leading The ignored, with letters", () => {
    const list = ok<Schemas["CollectionList"]>("/v1/collections");
    expect(list.data.map(c => c.id)).toEqual([
      13, 1, 2, 3, 4, 9, 5, 6, 7, 8, 10, 11, 12, 14,
    ]);
    expect(list.total).toBe(COLLECTIONS.length);
    expect(list.letters).toEqual([
      { letter: "0", count: 1 },
      { letter: "A", count: 1 },
      { letter: "B", count: 1 },
      { letter: "C", count: 2 },
      { letter: "D", count: 1 },
      { letter: "E", count: 1 },
      { letter: "G", count: 1 },
      { letter: "H", count: 2 },
      { letter: "K", count: 1 },
      { letter: "L", count: 1 },
      { letter: "N", count: 1 },
      { letter: "W", count: 1 },
    ]);
    const h = ok<Schemas["CollectionList"]>("/v1/collections?letter=H");
    expect(h.data.map(c => c.id)).toEqual([7, 8]);
    expect(h.letters).toEqual(list.letters);
    expect(
      ok<Schemas["CollectionList"]>(
        "/v1/collections?kind=songbook_website&kind=wiki"
      ).data.map(c => c.id)
    ).toEqual([2, 12, 14]);
  });

  it("shows a collection's citations by owner sort key, its parent and children", () => {
    const songbook = ok<Schemas["Collection"]>(
      `/v1/collections/${NORTHMARCH_SONGBOOK_ID}`
    );
    expect(
      songbook.citations.map(c => c.piece?.slug ?? c.person?.slug)
    ).toEqual([
      "the-copper-kettle",
      "the-dragons-hoard",
      "midwinter-carol",
      "northmarch-bards",
      "northmarch-rising",
    ]);
    expect(songbook.citations_total).toBe(5);
    expect(songbook.children.map(c => c.id)).toEqual([13]);
    expect(songbook.region?.slug).toBe("northmarch");
    expect(ok<Schemas["Collection"]>("/v1/collections/13").parent?.id).toBe(
      NORTHMARCH_SONGBOOK_ID
    );
  });

  it("caps citations at 200, with the total", () => {
    const book = ok<Schemas["Collection"]>(`/v1/collections/${DRILL_BOOK_ID}`);
    expect(book.citations).toHaveLength(200);
    expect(book.citations_total).toBe(205);
  });

  it("lists events by name as written", () => {
    expect(slugs(ok<Schemas["EventList"]>("/v1/events"))).toEqual([
      "ashdown-twelfth-night",
      "caer-wyn-bardic-circle",
      "greywater-harvest-feast",
      "midwinter-revel",
      "muster-field",
      "quiet-hall",
      "the-copper-hearth",
      "westerfell-crown-tourney",
    ]);
    expect(slugs(ok<Schemas["EventList"]>("/v1/events?kind=venue"))).toEqual([
      "muster-field",
      "quiet-hall",
      "the-copper-hearth",
    ]);
    expect(ok<Schemas["EventList"]>("/v1/events").total).toBe(EVENTS.length);
  });

  it("shows an event's performances newest first, without no-page performers", () => {
    const revel = ok<Schemas["Event"]>(`/v1/events/${MIDWINTER_REVEL_SLUG}`);
    expect(
      revel.performances.map(p => [p.year, p.piece?.slug, p.performers.length])
    ).toEqual([
      [2025, "the-dragons-hoard", 1],
      [2025, "midwinter-carol", 3],
      [2023, "northmarch-rising", 0],
    ]);
    const field = ok<Schemas["Event"]>(`/v1/events/${MUSTER_FIELD_SLUG}`);
    expect(field.performances).toHaveLength(200);
    expect(field.performances_total).toBe(203);
    expect(ok<Schemas["Event"]>("/v1/events/quiet-hall").performances).toEqual(
      []
    );
  });

  it.each([
    ["/v1/collections/999", "collection not found"],
    ["/v1/events/no-such-event", "event not found"],
    ["/v1/persons/no-such-person", "person not found"],
  ])("answers 404 for %s", (path, message) => {
    expect(get(path)).toEqual({
      status: 404,
      body: { code: "not_found", message },
    });
  });
});

describe("revisions", () => {
  const history = (path: string) => ok<Schemas["RevisionHistory"]>(path);
  const revision = (id: number) =>
    ok<Schemas["Revision"]>(`/v1/revisions/${id}`);

  it("lists approved revisions only, newest first, paged", () => {
    const kettle = history("/v1/pieces/the-copper-kettle/history");
    expect(kettle.data.map(r => r.id)).toEqual([1014, 1004, 1003, 1001]);
    expect(kettle.total).toBe(4);
    expect(
      history("/v1/pieces/the-copper-kettle/history?limit=2&offset=1").data.map(
        r => r.id
      )
    ).toEqual([1004, 1003]);
    expect(kettle.data.at(-1)).toEqual({
      id: 1001,
      source: "import",
      summary: "",
      author: null,
      contributors: ["Archivist", "Lorekeeper"],
      created_at: "2025-01-10T12:00:00Z",
    });
    expect(
      history(`/v1/collections/${NORTHMARCH_SONGBOOK_ID}/history`).data.map(
        r => r.id
      )
    ).toEqual([1011, 1010]);
    expect(history("/v1/terms/war/history").total).toBe(2);
    expect(history("/v1/events/midwinter-revel/history").total).toBe(2);
    expect(history("/v1/persons/wren-of-the-vale/history").total).toBe(2);
    expect(history("/v1/persons/hollis-fenn/history")).toEqual({
      data: [],
      total: 0,
    });
  });

  it.each([
    ["/v1/pieces/no-such-piece/history", "piece not found"],
    ["/v1/persons/no-such-person/history", "person not found"],
    [`/v1/terms/${DRAFT_TOPIC_SLUG}/history`, "term not found"],
    ["/v1/collections/999/history", "collection not found"],
    ["/v1/events/no-such-event/history", "event not found"],
    [`/v1/revisions/${UNAPPROVED_REVISIONS[0]?.id}`, "revision not found"],
    ["/v1/revisions/999", "revision not found"],
  ])("answers 404 for %s", (path, message) => {
    expect(get(path)).toEqual({
      status: 404,
      body: { code: "not_found", message },
    });
  });

  it("has no base for an import, and lists its non-empty fields", () => {
    const imported = revision(1001);
    expect(imported).toMatchObject({
      base_revision_id: null,
      base_snapshot: null,
    });
    expect(imported.changed_fields).toEqual([
      "conservation_status",
      "kind",
      "licensing_status",
      "notes_md",
      "relations",
      "terms",
      "title",
    ]);
  });

  it("diffs a revision against its approved base", () => {
    const diff = revision(1003);
    expect(diff.base_revision_id).toBe(1001);
    expect(diff.changed_fields).toEqual([
      "aliases",
      "conservation_source_url",
      "conservation_status",
      "credits",
      "licence",
      "licensing_status",
      "links",
      "notes_md",
      "period_end",
      "period_start",
      "relations",
      "secondary_kinds",
      "terms",
      "title",
    ]);
    const hoard = revision(1005);
    expect(hoard.entity_type === "piece" && hoard.base_snapshot).toMatchObject({
      conservation_status: "endangered",
    });
  });

  it("redacts snapshots by what is visible now, and computes the diff on the redacted views", () => {
    const later = revision(1014);
    expect(later.changed_fields).toEqual([]);
    const body = JSON.stringify(later);
    expect(body).not.toContain("HIDDEN-");
    expect(body).not.toContain("hollis-fenn");
  });

  it("shows a stored name only if it is the person's name or a public alias now", () => {
    const imported = revision(1006);
    expect(imported.entity_type === "person" && imported.snapshot.name).toBe(
      "Wren of the Vale"
    );
    expect(revision(1007).changed_fields).toEqual(["profile"]);
    const aliases =
      revision(1007).entity_type === "person"
        ? (revision(1007) as Schemas["PersonRevision"]).snapshot.profile
            ?.aliases
        : [];
    expect(aliases?.map(a => a.kind)).toEqual(["sca", "stage"]);
  });

  it("is validated against the shape its entity_type names", () => {
    const body = revision(1012);
    expect(responseProblems("getRevision", 200, body)).toEqual([]);
    expect(
      responseProblems("getRevision", 200, { ...body, entity_type: "piece" })
    ).not.toEqual([]);
  });

  it("refers to entities as they are now", () => {
    expect(revision(1010)).toMatchObject({
      entity: { id: NORTHMARCH_SONGBOOK_ID, name: "The Northmarch Songbook" },
    });
    expect(revision(1002)).toMatchObject({
      entity: { slug: "the-dragons-hoard", conservation_status: "restricted" },
    });
  });
});

describe("needs-work", () => {
  const needsWork = (path: string) => ok<Schemas["NeedsWorkList"]>(path);

  it("lists stubs with a page, pieces first, and counts every reason whatever the filter", () => {
    const stubs = needsWork("/v1/needs-work?reason=stub");
    expect(stubs.data).toEqual([
      {
        entity_type: "piece",
        slug: "the-unfinished-lay",
        title: "The Unfinished Lay",
        reasons: ["stub", "unassessed", "missing_licensing"],
      },
      {
        entity_type: "person",
        slug: "jorund-of-the-north-shore",
        title: "Jorund of the North Shore",
        reasons: ["stub", "missing_licensing"],
      },
      {
        entity_type: "person",
        slug: "tamsin-of-the-reeds",
        title: "Tamsin of the Reeds",
        reasons: ["stub", "missing_licensing"],
      },
    ]);
    expect(stubs.total).toBe(3);
    expect(stubs.counts.map(c => c.reason)).toEqual([
      "stub",
      "unassessed",
      "missing_licensing",
      "dead_links",
    ]);
    expect(needsWork("/v1/needs-work?reason=dead_links").counts).toEqual(
      stubs.counts
    );
  });

  it("lists a restricted piece only for being a stub, and only visible dead links", () => {
    expect(
      needsWork("/v1/needs-work?reason=dead_links").data.map(e => e.slug)
    ).toEqual(["the-ashdown-wassail", "the-copper-kettle"]);
    const all = needsWork("/v1/needs-work?limit=100&offset=0");
    const listed = new Set(
      [0, 100, 200, 300].flatMap(offset =>
        needsWork(`/v1/needs-work?limit=100&offset=${offset}`).data.map(
          e => e.slug
        )
      )
    );
    expect(listed.size).toBe(all.total);
    for (const slug of [
      "the-dragons-hoard",
      "the-silent-reel",
      "hollis-fenn",
      "corwin-ashgrove",
    ]) {
      expect(listed.has(slug), slug).toBe(false);
    }
  });
});

describe("the short pages of the screenshots", () => {
  it("keeps the plan's pages short", () => {
    expect(pieces("/v1/pieces?letter=T").total).toBeLessThanOrEqual(8);
    const poems = pieces("/v1/pieces?kind=poem&term=eerie").total;
    expect(poems).toBeGreaterThanOrEqual(2);
    expect(poems).toBeLessThanOrEqual(6);
    expect(
      ok<Schemas["PersonList"]>("/v1/persons?letter=W").total
    ).toBeLessThanOrEqual(8);
    expect(
      ok<Schemas["Term"]>("/v1/terms/swords").piece_count
    ).toBeLessThanOrEqual(8);
    expect(
      ok<Schemas["Collection"]>(`/v1/collections/${NORTHMARCH_SONGBOOK_ID}`)
        .citations_total
    ).toBeLessThanOrEqual(10);
    expect(
      ok<Schemas["Event"]>(`/v1/events/${MIDWINTER_REVEL_SLUG}`)
        .performances_total
    ).toBeLessThanOrEqual(10);
    const collections = ok<Schemas["CollectionList"]>("/v1/collections");
    expect(collections.data).toHaveLength(collections.total);
    const events = ok<Schemas["EventList"]>("/v1/events");
    expect(events.data).toHaveLength(events.total);
  });
});

/** Every request the leak scan sends: each entity's reads and the lists' filters. */
const SCAN_PATHS: readonly string[] = [
  "/v1/pieces",
  ...[0, 50, 100, 150, 200].map(offset => `/v1/pieces?offset=${offset}`),
  "/v1/pieces?q=hidden",
  "/v1/pieces?q=pending",
  "/v1/pieces?q=hollis",
  "/v1/pieces?q=HIDDEN-",
  "/v1/pieces?term=war&kind=poem&conservation_status=restricted",
  "/v1/persons",
  "/v1/persons?q=hidden",
  "/v1/persons?q=legal+alias",
  "/v1/persons?q=wren",
  "/v1/persons?affiliation=northmarch&role=singer",
  "/v1/terms",
  "/v1/collections",
  "/v1/events",
  ...["stub", "unassessed", "missing_licensing", "dead_links"].map(
    reason => `/v1/needs-work?reason=${reason}`
  ),
  ...[0, 100, 200, 300].map(
    offset => `/v1/needs-work?limit=100&offset=${offset}`
  ),
  ...PIECES.flatMap(p => [
    `/v1/pieces/${p.slug}`,
    `/v1/pieces/${p.slug}/history`,
  ]),
  ...PERSONS.flatMap(p => [
    `/v1/persons/${p.slug}`,
    `/v1/persons/${p.slug}/history`,
  ]),
  ...TERMS.flatMap(t => [
    `/v1/terms/${t.slug}`,
    `/v1/terms/${t.slug}?limit=100&offset=100`,
    `/v1/terms/${t.slug}/history`,
  ]),
  ...COLLECTIONS.flatMap(c => [
    `/v1/collections/${c.id}`,
    `/v1/collections/${c.id}/history`,
  ]),
  ...EVENTS.flatMap(e => [
    `/v1/events/${e.slug}`,
    `/v1/events/${e.slug}/history`,
  ]),
  ...[...REVISIONS, ...UNAPPROVED_REVISIONS].map(r => `/v1/revisions/${r.id}`),
];

describe("the leak scan", () => {
  const responses = SCAN_PATHS.map(path => {
    const response = get(path);
    return {
      path,
      status: response.status,
      body: JSON.stringify(response.body),
    };
  });

  it("covers every operation that serves data", () => {
    expect(responses.filter(r => r.status === 200).length).toBeGreaterThan(
      PIECES.length * 2
    );
  });

  it("serves no HIDDEN- marker in any body", () => {
    expect(
      responses.filter(r => r.body.includes("HIDDEN-")).map(r => r.path)
    ).toEqual([]);
  });

  it("serves no unapproved term in any body", () => {
    expect(
      responses
        .filter(
          r =>
            r.body.includes(DRAFT_TOPIC_SLUG) || r.body.includes("Draft topic")
        )
        .map(r => r.path)
    ).toEqual([]);
  });

  it("names a no-page person only in person lists and on their own page", () => {
    for (const slug of ["hollis-fenn", "corwin-ashgrove"]) {
      expect(
        responses
          .filter(r => r.body.includes(slug))
          .map(r => r.path)
          .filter(
            path =>
              !path.startsWith("/v1/persons?") &&
              path !== "/v1/persons" &&
              path !== `/v1/persons/${slug}`
          )
      ).toEqual([]);
    }
  });

  it("answers only 200 or 404 for an existing route", () => {
    expect(
      responses
        .filter(r => r.status !== 200 && r.status !== 404)
        .map(r => r.path)
    ).toEqual([]);
  });
});
