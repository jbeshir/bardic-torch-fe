import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  DRILL_BOOK_ID,
  NORTHMARCH_SONGBOOK_ID,
} from "./collections";
import {
  EVENTS,
  MIDWINTER_REVEL_SLUG,
  MUSTER_FIELD_SLUG,
  QUIET_HALL_SLUG,
} from "./events";
import {
  DRILL_BARD_SLUG,
  DRILL_COUNT,
  DRILL_LINKS,
  DRILL_PERFORMANCE_COUNT,
  DRILL_PIECES,
  generateDrillSongs,
} from "./generated";
import { HIDDEN_LINK_MARKER, LINKS, RESTRICTED_HOST } from "./links";
import {
  HIDDEN_LEGAL_ALIAS,
  PERSON_RELATIONS,
  PERSONS,
  personSummary,
} from "./persons";
import {
  HIDDEN_CREDIT_NOTE,
  PIECE_RELATIONS,
  PIECES,
  pieceSummary,
} from "./pieces";
import { REVISIONS } from "./revisions";
import {
  DRAFT_CHILD_SLUG,
  DRAFT_TOPIC_SLUG,
  EMPTY_ROOT_SLUG,
  TERMS,
} from "./terms";

const termSlugs = new Set(TERMS.map(t => t.slug));
const personSlugs = new Set(PERSONS.map(p => p.slug));
const pieceSlugs = new Set(PIECES.map(p => p.slug));
const eventSlugs = new Set(EVENTS.map(e => e.slug));
const collectionIds = new Set(COLLECTIONS.map(c => c.id));
const handPieces = PIECES.filter(p => !p.slug.startsWith("drill-song-"));

/** The PLAN §4.1 letter rule, enough to place the fixture titles. */
function letterOf(title: string): string {
  const stripped = title
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^Þ/u, "T")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const first = stripped.charAt(0).toUpperCase();
  return /\d/.test(first) ? "0" : first;
}

function pieceLetters(): ReadonlyMap<string, readonly string[]> {
  const byLetter = new Map<string, string[]>();
  for (const p of PIECES) {
    const letter = letterOf(p.title);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), p.slug]);
  }
  return byLetter;
}

describe("referential integrity", () => {
  it("has unique keys in every table", () => {
    for (const keys of [
      TERMS.map(t => t.slug),
      PERSONS.map(p => p.slug),
      PIECES.map(p => p.slug),
      EVENTS.map(e => e.slug),
      COLLECTIONS.map(c => c.id),
      LINKS.map(l => l.id),
      REVISIONS.map(r => r.id),
    ]) {
      expect(new Set<unknown>(keys).size).toBe(keys.length);
    }
  });

  it("only refers to terms that exist, in the right facets", () => {
    for (const t of TERMS) {
      if (t.parent !== null) {
        expect(termSlugs.has(t.parent), t.slug).toBe(true);
        expect(TERMS.find(p => p.slug === t.parent)?.facet).toBe(t.facet);
      }
      if (t.related_affiliation !== null) {
        expect(TERMS.find(a => a.slug === t.related_affiliation)?.facet).toBe(
          "affiliation"
        );
      }
    }
    for (const p of PIECES) {
      for (const pt of p.terms) {
        const term = TERMS.find(t => t.slug === pt.term);
        expect(term, `${p.slug}: ${pt.term}`).toBeDefined();
        expect(term?.facet).not.toBe("affiliation");
      }
    }
    for (const person of PERSONS) {
      for (const a of person.profile?.affiliations ?? []) {
        expect(TERMS.find(t => t.slug === a)?.facet).toBe("affiliation");
      }
    }
    for (const c of COLLECTIONS) {
      if (c.region !== null) expect(termSlugs.has(c.region)).toBe(true);
    }
  });

  it("only refers to people, pieces, events and collections that exist", () => {
    for (const p of PIECES) {
      for (const c of p.credits) {
        if (c.person !== null) expect(personSlugs.has(c.person)).toBe(true);
      }
    }
    for (const r of PIECE_RELATIONS) {
      expect(pieceSlugs.has(r.from) && pieceSlugs.has(r.to)).toBe(true);
    }
    for (const r of PERSON_RELATIONS) {
      expect(personSlugs.has(r.from) && personSlugs.has(r.to)).toBe(true);
    }
    for (const l of LINKS) {
      const owners = l.owner.kind === "piece" ? pieceSlugs : personSlugs;
      expect(owners.has(l.owner.slug), `link ${l.id}`).toBe(true);
      if (l.collection !== null)
        expect(collectionIds.has(l.collection)).toBe(true);
      for (const perf of l.performances) {
        if (perf.event !== null) expect(eventSlugs.has(perf.event)).toBe(true);
        for (const who of perf.performers)
          expect(personSlugs.has(who)).toBe(true);
      }
    }
    for (const c of COLLECTIONS) {
      if (c.parent !== null) expect(collectionIds.has(c.parent)).toBe(true);
    }
  });

  it("builds every revision's references (the builders throw on an unknown slug)", () => {
    expect(REVISIONS.length).toBeGreaterThan(0);
  });
});

describe("terms", () => {
  it("covers all 9 facets, with a 3-deep topic tree and two peerage chains", () => {
    expect(new Set(TERMS.map(t => t.facet)).size).toBe(9);
    const parentOf = new Map(TERMS.map(t => [t.slug, t.parent]));
    const depth = (slug: string): number =>
      parentOf.get(slug) ? 1 + depth(parentOf.get(slug) as string) : 0;
    expect(depth("swords")).toBe(2);
    expect(parentOf.get("battles")).toBe("war");
    expect(depth("squires")).toBe(2);
    expect(parentOf.get("sca-peerage-pieces")).toBe("sca");
    expect(parentOf.get("contrafacta-modern")).toBe("contrafacta");
    expect(parentOf.get("contrafacta-sca")).toBe("contrafacta");
  });

  it("disambiguates names but not display names", () => {
    const by = new Map(TERMS.map(t => [t.slug, t]));
    expect(by.get("12th-century")).toMatchObject({
      facet: "origin",
      display_name: "12th Century",
      name: "12th Century (Origin)",
    });
    expect(by.get("12th-century-topic")).toMatchObject({
      facet: "topic",
      display_name: "12th Century",
      name: "12th Century (Topic)",
    });
    expect(by.get("story-mood")?.display_name).toBe("Story");
    expect(by.get("story-form")?.display_name).toBe("Story");
    expect(by.get("story-mood")?.facet).toBe("mood");
    expect(by.get("story-form")?.facet).toBe("form");
  });

  it("has an unapproved term with a child, and an empty facet root", () => {
    const by = new Map(TERMS.map(t => [t.slug, t]));
    expect(by.get(DRAFT_TOPIC_SLUG)?.approved).toBe(false);
    expect(by.get(DRAFT_CHILD_SLUG)).toMatchObject({
      approved: false,
      parent: DRAFT_TOPIC_SLUG,
    });
    expect(TERMS.filter(t => !t.approved)).toHaveLength(2);
    const used = new Set(PIECES.flatMap(p => p.terms.map(t => t.term)));
    expect(used.has(EMPTY_ROOT_SLUG)).toBe(false);
    expect(by.get(EMPTY_ROOT_SLUG)?.parent).toBeNull();
    expect(used.has(DRAFT_TOPIC_SLUG) || used.has(DRAFT_CHILD_SLUG)).toBe(
      false
    );
  });

  it("has the vocabulary the plan lists", () => {
    const names = (facet: string) =>
      TERMS.filter(t => t.facet === facet).map(t => t.display_name);
    expect(names("mood")).toEqual(
      expect.arrayContaining([
        "Warlike",
        "Comedic",
        "Sentimental",
        "Joyful",
        "Singalong",
        "Tragic",
        "Story",
        "Eerie",
        "Relaxed",
        "Rude",
        "Leaving songs",
        "Romantic",
        "Comforting",
      ])
    );
    expect(names("culture")).toEqual(
      expect.arrayContaining([
        "English",
        "Gaelic",
        "Norse",
        "French",
        "Welsh",
        "Spanish",
      ])
    );
    expect(names("language")).toEqual(
      expect.arrayContaining(["Middle English", "Welsh", "Portuguese", "ASL"])
    );
    expect(names("legendaria")).toEqual(["Fenian Cycle", "Arthuriana"]);
    expect(names("form")).toEqual(
      expect.arrayContaining(["Ballad", "Round", "Filk", "Story"])
    );
    expect(names("origin")).toEqual(
      expect.arrayContaining([
        "SCA pieces",
        "Traditional and folk",
        "Pre-1600 sources",
        "Contrafacta",
        "Modern",
        "SCA",
        "12th Century",
        "13th Century",
        "16th Century",
        "18th Century",
        "20th Century",
      ])
    );
    expect(names("topic")).toEqual(
      expect.arrayContaining([
        "War",
        "Battles",
        "Swords",
        "SCA",
        "SCA peerage pieces",
        "Squires",
        "Historical people and events",
        "Love",
        "Drinking",
        "Virtues",
        "Death",
        "Wandering",
      ])
    );
  });
});

describe("pieces", () => {
  it("has about forty hand-written pieces and about 245 in all", () => {
    expect(handPieces.length).toBeGreaterThanOrEqual(40);
    expect(PIECES.length).toBeGreaterThanOrEqual(241);
    expect(PIECES.length).toBeLessThanOrEqual(250);
  });

  it("has every conservation status at least twice and every kind, with secondaries", () => {
    for (const status of [
      "low_risk",
      "endangered",
      "critically_endangered",
      "restricted",
      "unassessed",
    ] as const) {
      expect(
        handPieces.filter(p => p.conservation_status === status).length,
        status
      ).toBeGreaterThanOrEqual(2);
    }
    for (const kind of [
      "song",
      "poem",
      "story",
      "dance_music",
      "instrumental",
      "comedy",
    ] as const) {
      expect(
        PIECES.some(p => p.kind === kind),
        kind
      ).toBe(true);
    }
    expect(PIECES.some(p => p.secondary_kinds.length > 0)).toBe(true);
  });

  it("places letters as the plan says, with none for Q, X and Z", () => {
    const letters = pieceLetters();
    for (const letter of ["0", "A", "D", "T"])
      expect(letters.has(letter), letter).toBe(true);
    for (const letter of ["Q", "X", "Z"])
      expect(letters.has(letter), letter).toBe(false);
    expect(letters.get("0")).toContain("1588-armada-ballad");
    expect(letters.get("D")).toContain("donde-esta");
    expect(letters.get("T")).toContain("thorvalds-lament");
    expect(letters.get("A")).toContain("the-ashdown-wassail");
    expect(letters.get("T")?.length).toBeLessThanOrEqual(8);
  });

  it("has a stub with no links, two restricted pieces and a 15-term piece", () => {
    const stub = PIECES.find(p => p.slug === "the-unfinished-lay");
    expect(stub?.is_stub).toBe(true);
    expect(LINKS.some(l => l.owner.slug === "the-unfinished-lay")).toBe(false);
    const restricted = PIECES.filter(
      p => p.conservation_status === "restricted"
    );
    expect(restricted.map(p => p.slug).sort()).toEqual([
      "the-dragons-hoard",
      "the-silent-reel",
    ]);
    const hoard = restricted.find(p => p.slug === "the-dragons-hoard");
    expect(hoard?.conservation_history.at(-1)).toMatchObject({
      conservation_status: "restricted",
    });
    expect(hoard?.conservation_history.at(-1)?.source_url).toMatch(/^https:/);
    expect(
      restricted
        .find(p => p.slug === "the-silent-reel")
        ?.conservation_history.at(-1)?.source_url
    ).toBeNull();
    expect(
      PIECES.find(p => p.slug === "the-long-road-north")?.terms
    ).toHaveLength(15);
  });

  it("keeps each piece's status equal to the end of its history", () => {
    for (const p of PIECES) {
      const last = p.conservation_history.at(-1);
      if (last)
        expect(last.conservation_status, p.slug).toBe(p.conservation_status);
    }
  });

  it("credits the no-page person upstream of the wassail and keeps the tune traditional", () => {
    const wassail = PIECES.find(p => p.slug === "the-ashdown-wassail");
    const lyrics = wassail?.credits.find(c => c.role === "lyrics");
    expect(lyrics?.person).toBe("hollis-fenn");
    expect(personSummary("hollis-fenn").is_stub).toBe(true);
    expect(wassail?.credits.find(c => c.role === "tune")).toMatchObject({
      person: null,
      attribution: "traditional",
    });
    expect(lyrics?.note).toBe(HIDDEN_CREDIT_NOTE);
  });

  it("has every attribution and certainty, parts, notes and period variants", () => {
    const credits = PIECES.flatMap(p => p.credits);
    expect(new Set(credits.map(c => c.attribution))).toEqual(
      new Set(["named", "traditional", "unknown", "anonymous", "various"])
    );
    expect(new Set(credits.map(c => c.certainty))).toEqual(
      new Set(["certain", "probable", "possible", "disputed"])
    );
    expect(new Set(credits.map(c => c.role))).toEqual(
      new Set([
        "lyrics",
        "tune",
        "author",
        "choreography",
        "music",
        "arrangement",
        "translation",
      ])
    );
    expect(credits.some(c => c.part !== null)).toBe(true);
    expect(credits.some(c => c.note !== null)).toBe(true);
    const terms = PIECES.flatMap(p => p.terms);
    expect(terms.some(t => t.part !== null)).toBe(true);
    expect(terms.some(t => t.is_primary && t.part !== null)).toBe(true);
    const periods = new Set(
      PIECES.map(p => `${p.period_start === null}/${p.period_end === null}`)
    );
    expect(periods).toEqual(
      new Set(["true/true", "false/true", "true/false", "false/false"])
    );
  });

  it("has aliases of each kind, including redirect", () => {
    expect(new Set(PIECES.flatMap(p => p.aliases.map(a => a.kind)))).toEqual(
      new Set(["alt_title", "nickname", "subtitle", "redirect"])
    );
  });

  it("has relations of all 4 types", () => {
    expect(new Set(PIECE_RELATIONS.map(r => r.type))).toEqual(
      new Set([
        "variant_of",
        "contrafactum_of",
        "setting_of",
        "same_text_other_form",
      ])
    );
  });

  it("has markdown notes with a link, emphasis, a list and raw HTML", () => {
    const notes =
      PIECES.find(p => p.slug === "the-copper-kettle")?.notes_md ?? "";
    expect(notes).toMatch(/\[[^\]]+\]\(https:/);
    expect(notes).toMatch(/\*[^*]+\*/);
    expect(notes).toMatch(/^- /m);
    expect(notes).toMatch(/<span/);
  });

  it("covers all 9 licences and an unknown one", () => {
    expect(new Set(PIECES.map(p => p.licence))).toEqual(
      new Set([
        "pd",
        "cc_by",
        "cc_by_sa",
        "cc_by_nc",
        "cc_by_nc_sa",
        "cc_by_nd",
        "cc_by_nc_nd",
        "arr",
        "other",
        null,
      ])
    );
    for (const p of PIECES) {
      expect(p.licensing_status === "known", p.slug).toBe(p.licence !== null);
    }
  });

  it("keeps /pieces?kind=poem&term=eerie short", () => {
    const hits = PIECES.filter(
      p =>
        (p.kind === "poem" || p.secondary_kinds.includes("poem")) &&
        p.terms.some(t => t.term === "eerie")
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.length).toBeLessThanOrEqual(6);
  });

  it("builds summaries", () => {
    expect(pieceSummary("the-copper-kettle")).toMatchObject({
      slug: "the-copper-kettle",
      conservation_status: "endangered",
    });
  });
});

describe("links", () => {
  const handLinks = LINKS.filter(l => l.id < 10001);

  it("has every role, place type and liveness", () => {
    expect(new Set(LINKS.flatMap(l => l.roles))).toEqual(
      new Set([
        "official",
        "lyrics",
        "text",
        "sheet_music",
        "dance_instructions",
        "text_source",
        "translation",
        "performance",
        "licensing_source",
        "website",
        "external_profile",
        "other",
      ])
    );
    expect(new Set(LINKS.map(l => l.place_type).filter(Boolean))).toEqual(
      new Set([
        "recording_platform",
        "streaming",
        "author_site",
        "community_archive",
        "physical_archive",
        "book",
        "vendor",
        "author_contact",
        "oral_tradition",
        "other",
      ])
    );
    expect(new Set(LINKS.map(l => l.liveness))).toEqual(
      new Set(["unknown", "ok", "dead", "blocked"])
    );
  });

  it("has the liveness shapes: dead with and without an archive, ok with a check date", () => {
    expect(
      handLinks.some(l => l.liveness === "dead" && l.archived_url !== null)
    ).toBe(true);
    expect(
      handLinks.some(l => l.liveness === "dead" && l.archived_url === null)
    ).toBe(true);
    for (const l of LINKS) {
      if (l.liveness === "ok")
        expect(l.last_checked_at, String(l.id)).not.toBeNull();
    }
  });

  it("has a link with 3 roles, one in a collection with a locator, and one hidden link", () => {
    expect(handLinks.some(l => l.roles.length === 3)).toBe(true);
    expect(
      handLinks.some(l => l.collection !== null && l.locator !== null)
    ).toBe(true);
    const hidden = LINKS.filter(l => l.hidden);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ owner: { slug: "the-copper-kettle" } });
    expect(hidden[0]?.url).toContain(HIDDEN_LINK_MARKER);
  });

  it("has performances with a year, no year, an event, an uploader, several performers and a no-page performer", () => {
    const perfs = handLinks.flatMap(l => l.performances);
    expect(perfs.some(p => p.year !== null)).toBe(true);
    expect(perfs.some(p => p.year === null)).toBe(true);
    expect(perfs.some(p => p.event !== null)).toBe(true);
    expect(perfs.some(p => p.uploader !== null)).toBe(true);
    expect(perfs.some(p => p.performers.length > 1)).toBe(true);
    expect(perfs.some(p => p.performers.includes("hollis-fenn"))).toBe(true);
  });
});

describe("persons", () => {
  it("has the three kinds, a disbanded group, and the statuses", () => {
    expect(new Set(PERSONS.map(p => p.kind))).toEqual(
      new Set(["community_bard", "historical", "group"])
    );
    expect(
      PERSONS.some(p => p.kind === "group" && p.status === "deceased")
    ).toBe(true);
    expect(
      PERSONS.filter(p => p.status === "deceased" && p.status_date !== null)
        .length
    ).toBeGreaterThan(0);
    const hollis = PERSONS.find(p => p.slug === "hollis-fenn");
    expect(hollis).toMatchObject({
      status: "prefers_no_page",
      profile: null,
      is_stub: true,
    });
    expect(hollis?.status_source_url).toMatch(/^https:/);
  });

  it("has no profile exactly for the no-page people, and a stub with a profile", () => {
    for (const p of PERSONS)
      expect(p.profile === null, p.slug).toBe(p.status === "prefers_no_page");
    expect(PERSONS.some(p => p.is_stub && p.profile !== null)).toBe(true);
  });

  it("has public aliases of each kind and a hidden legal alias on Wren", () => {
    const aliases = PERSONS.flatMap(p => p.profile?.aliases ?? []);
    expect(new Set(aliases.map(a => a.kind))).toEqual(
      new Set(["legal", "sca", "stage", "nickname", "former", "redirect"])
    );
    const wren = PERSONS.find(p => p.slug === "wren-of-the-vale");
    expect(wren?.profile?.aliases.find(a => a.hidden)).toMatchObject({
      kind: "legal",
      name: HIDDEN_LEGAL_ALIAS,
    });
    expect(aliases.filter(a => a.hidden)).toHaveLength(1);
  });

  it("has roles, affiliations, relations of all types, and known and unknown licensing", () => {
    expect(new Set(PERSON_RELATIONS.map(r => r.type))).toEqual(
      new Set(["heir_of", "member_of", "same_as"])
    );
    expect(
      PERSON_RELATIONS.filter(
        r => r.type === "member_of" && r.to === "northmarch-bards"
      ).length
    ).toBeGreaterThanOrEqual(1);
    const profiles = PERSONS.flatMap(p => (p.profile ? [p.profile] : []));
    expect(new Set(profiles.map(p => p.licensing_status))).toEqual(
      new Set(["known", "unknown"])
    );
    expect(profiles.some(p => p.roles.length > 0)).toBe(true);
    expect(profiles.some(p => p.affiliations.length > 0)).toBe(true);
    const external = LINKS.filter(l => l.owner.kind === "person").flatMap(
      l => l.roles
    );
    expect(external).toEqual(
      expect.arrayContaining(["website", "external_profile"])
    );
  });

  it("keeps /bards?letter=W short", () => {
    expect(
      PERSONS.filter(p => letterOf(p.name) === "W").length
    ).toBeLessThanOrEqual(8);
  });
});

describe("the generated capped lists", () => {
  it("is deterministic", () => {
    expect(generateDrillSongs()).toEqual(generateDrillSongs());
  });

  it("makes 205 practice pieces by one bard, all cited by one collection", () => {
    expect(DRILL_PIECES).toHaveLength(DRILL_COUNT);
    expect(DRILL_PIECES[0]?.title).toBe("Drill Song 001");
    expect(DRILL_PIECES.at(-1)?.title).toBe("Drill Song 205");
    for (const p of DRILL_PIECES) {
      expect(p).toMatchObject({
        kind: "song",
        conservation_status: "unassessed",
      });
      expect(p.credits.map(c => c.person)).toEqual([DRILL_BARD_SLUG]);
      expect(p.terms.map(t => t.term).sort()).toEqual(["joyful", "sca-pieces"]);
      expect(letterOf(p.title)).toBe("D");
    }
    expect(DRILL_LINKS).toHaveLength(DRILL_COUNT);
    expect(DRILL_LINKS.every(l => l.collection === DRILL_BOOK_ID)).toBe(true);
    expect(COLLECTIONS.find(c => c.id === DRILL_BOOK_ID)?.name).toBe(
      "The Drill Book"
    );
  });

  it("has 203 performances at Muster Field, one of them the restricted piece's", () => {
    const atMuster = LINKS.flatMap(l =>
      l.performances
        .filter(p => p.event === MUSTER_FIELD_SLUG)
        .map(() => l.owner.slug)
    );
    expect(atMuster).toHaveLength(203);
    expect(atMuster.filter(s => s === "the-dragons-hoard")).toHaveLength(1);
    expect(atMuster.filter(s => s.startsWith("drill-song-"))).toHaveLength(
      DRILL_PERFORMANCE_COUNT
    );
    expect(EVENTS.find(e => e.slug === MUSTER_FIELD_SLUG)?.kind).toBe("venue");
  });

  it("gives /pieces about five pages of 50", () => {
    expect(Math.ceil(PIECES.length / 50)).toBe(5);
  });
});

describe("collections and events", () => {
  it("has about 14 collections: every kind, every enumerable, both bardic flags", () => {
    expect(COLLECTIONS).toHaveLength(14);
    expect(new Set(COLLECTIONS.map(c => c.kind))).toEqual(
      new Set([
        "index_or_link_list",
        "songbook_pdf",
        "songbook_website",
        "website",
        "wiki_category",
        "wiki",
        "youtube_channel",
        "youtube_playlist",
        "google_doc_songbook",
        "blog",
        "archived_songbook",
        "hosted_document",
        "other",
      ])
    );
    expect(new Set(COLLECTIONS.map(c => c.enumerable))).toEqual(
      new Set(["unknown", "yes", "pdf", "browser", "api", "no"])
    );
    expect(new Set(COLLECTIONS.map(c => c.is_bardic_resource))).toEqual(
      new Set([true, false])
    );
  });

  it("has a leading-digit name, “The …” names, empty letters, a parent, a region and a null URL", () => {
    const letters = new Set(COLLECTIONS.map(c => letterOf(c.name)));
    expect(letters.has("0")).toBe(true);
    expect(
      COLLECTIONS.find(c => c.name === "2nd Northmarch Songbook")
    ).toBeDefined();
    expect(
      COLLECTIONS.filter(c => c.name.startsWith("The ")).length
    ).toBeGreaterThanOrEqual(2);
    expect(letters.has("Q")).toBe(false);
    expect(letters.has("F")).toBe(false);
    expect(COLLECTIONS.some(c => c.parent !== null)).toBe(true);
    expect(COLLECTIONS.some(c => c.region !== null)).toBe(true);
    expect(COLLECTIONS.some(c => c.url === null)).toBe(true);
  });

  it("has about 8 events and venues, one without performances, and short pages", () => {
    expect(EVENTS).toHaveLength(8);
    expect(new Set(EVENTS.map(e => e.kind))).toEqual(
      new Set(["venue", "event"])
    );
    expect(
      EVENTS.some(e => e.slug === "the-copper-hearth" && e.kind === "venue")
    ).toBe(true);
    const performedAt = (slug: string) =>
      LINKS.flatMap(l => l.performances).filter(p => p.event === slug).length;
    expect(performedAt(QUIET_HALL_SLUG)).toBe(0);
    expect(performedAt(MIDWINTER_REVEL_SLUG)).toBeGreaterThan(0);
    expect(performedAt(MIDWINTER_REVEL_SLUG)).toBeLessThanOrEqual(10);
    const cited = LINKS.filter(
      l => l.collection === NORTHMARCH_SONGBOOK_ID && !l.hidden
    );
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.length).toBeLessThanOrEqual(10);
    expect(COLLECTIONS.length).toBeLessThanOrEqual(50);
    expect(EVENTS.length).toBeLessThanOrEqual(50);
  });

  it("keeps /categories/swords short", () => {
    const members = PIECES.filter(p => p.terms.some(t => t.term === "swords"));
    expect(members.length).toBeLessThanOrEqual(8);
    expect(members.length).toBeGreaterThan(0);
  });
});

describe("the restricted piece's reach", () => {
  const hoardLinks = LINKS.filter(l => l.owner.slug === "the-dragons-hoard");

  it("is credited to Wren, performed at Muster Field and Midwinter Revel, cited in the songbook and performed by Wren", () => {
    const hoard = PIECES.find(p => p.slug === "the-dragons-hoard");
    expect(hoard?.credits.map(c => c.person)).toContain("wren-of-the-vale");
    const events = hoardLinks.flatMap(l => l.performances.map(p => p.event));
    expect(events).toEqual(
      expect.arrayContaining([MUSTER_FIELD_SLUG, MIDWINTER_REVEL_SLUG])
    );
    expect(hoardLinks.some(l => l.collection === NORTHMARCH_SONGBOOK_ID)).toBe(
      true
    );
    expect(
      hoardLinks
        .flatMap(l => l.performances)
        .some(p => p.performers.includes("wren-of-the-vale"))
    ).toBe(true);
    for (const l of hoardLinks)
      expect(new URL(l.url).host).toBe(RESTRICTED_HOST);
  });

  it("has a user revision whose base predates the restriction", () => {
    const revision = REVISIONS.find(
      r =>
        r.entity_type === "piece" &&
        r.entity.slug === "the-dragons-hoard" &&
        r.source === "user"
    );
    expect(revision?.entity_type).toBe("piece");
    if (revision?.entity_type !== "piece") return;
    expect(revision.base_snapshot?.conservation_status).toBe("endangered");
    expect(revision.snapshot.conservation_status).toBe("restricted");
    expect(revision.entity.conservation_status).toBe("restricted");
  });
});

describe("revisions", () => {
  it("starts at 1001 and has an import and a user revision for each entity type", () => {
    expect(Math.min(...REVISIONS.map(r => r.id))).toBe(1001);
    for (const type of [
      "piece",
      "person",
      "term",
      "collection",
      "event",
    ] as const) {
      const mine = REVISIONS.filter(r => r.entity_type === type);
      const imported = mine.find(r => r.source === "import");
      expect(imported, type).toMatchObject({
        author: null,
        base_revision_id: null,
        base_snapshot: null,
        contributors: ["Archivist", "Lorekeeper"],
      });
      const user = mine.find(
        r => r.source === "user" && r.base_revision_id === imported?.id
      );
      expect(user, type).toBeDefined();
      expect(user?.base_snapshot).not.toBeNull();
    }
  });

  it("makes 1003 the piece diff with changed fields of every kind", () => {
    const r = REVISIONS.find(x => x.id === 1003);
    expect(r?.entity_type).toBe("piece");
    if (r?.entity_type !== "piece") return;
    expect(r.changed_fields).toEqual(
      expect.arrayContaining([
        "title",
        "licence",
        "conservation_status",
        "secondary_kinds",
        "aliases",
        "terms",
        "credits",
        "relations",
        "links",
        "notes_md",
      ])
    );
    expect([...r.changed_fields]).toEqual([...r.changed_fields].sort());
  });

  it("has an mcp revision with an empty summary and a person revision with a profile change", () => {
    expect(REVISIONS.find(r => r.source === "mcp")).toMatchObject({
      summary: "",
      entity_type: "piece",
    });
    const person = REVISIONS.find(
      r => r.entity_type === "person" && r.source === "user"
    );
    expect(person?.changed_fields).toContain("profile");
  });

  it("has a revision that snapshots a now-hidden link and a now-no-page person", () => {
    const r = REVISIONS.find(
      x =>
        x.entity_type === "piece" &&
        x.snapshot.links.some(l => l.url.includes(HIDDEN_LINK_MARKER))
    );
    expect(r?.entity_type).toBe("piece");
    if (r?.entity_type !== "piece") return;
    expect(r.snapshot.credits.some(c => c.person?.slug === "hollis-fenn")).toBe(
      true
    );
  });
});
