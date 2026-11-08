import { describe, expect, it } from "vitest";
import type { Piece } from "~/schemas/catalogue";
import { linkOf, personOf, pieceOf, profileOf, WREN } from "~/test/catalogue";
import { personStructuredData, pieceStructuredData } from "./structured-data";

const ORIGIN = "https://bardictorch.example";

const BARDS = {
  slug: "northmarch-bards",
  name: "Northmarch Bards",
  kind: "group",
  is_stub: false,
} as const;

const piece = (overrides: Partial<Piece> = {}) =>
  pieceOf({
    slug: "the-long-road",
    title: "The Long Road",
    kind: "poem",
    conservation_status: "low_risk",
    ...overrides,
  });

const credit = (
  role: Piece["credits"][number]["role"],
  person: typeof WREN | typeof BARDS | null
) =>
  ({
    role,
    attribution: person ? "named" : "traditional",
    certainty: "certain",
    part: null,
    note: null,
    person,
  }) as const;

describe("pieceStructuredData", () => {
  it("describes a poem as a CreativeWork, every named credit its author", () => {
    expect(
      pieceStructuredData(
        piece({
          aliases: [
            { text: "Long Road", kind: "nickname" },
            { text: "Road (Long)", kind: "redirect" },
          ],
          credits: [credit("author", WREN), credit("translation", null)],
          terms: [
            {
              term: {
                slug: "middle-english",
                facet: "language",
                display_name: "Middle English",
              },
              is_primary: false,
              part: null,
            },
            {
              term: {
                slug: "english",
                facet: "culture",
                display_name: "English",
              },
              is_primary: false,
              part: null,
            },
          ],
        })
      )(ORIGIN)
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: "The Long Road",
      alternateName: ["Long Road"],
      genre: ["Poem"],
      author: [
        {
          "@type": "Person",
          name: "Wren of the Vale",
          url: `${ORIGIN}/bards/wren-of-the-vale`,
        },
      ],
      url: `${ORIGIN}/pieces/the-long-road`,
      inLanguage: ["Middle English"],
    });
  });

  it("describes music as a MusicComposition, its music's credits as composers and a group as a MusicGroup", () => {
    const data = pieceStructuredData(
      piece({
        kind: "instrumental",
        secondary_kinds: ["dance_music"],
        credits: [credit("lyrics", WREN), credit("music", BARDS)],
      })
    )(ORIGIN);
    expect(data).toMatchObject({
      "@type": "MusicComposition",
      genre: ["Instrumental", "Dance music"],
      author: [{ "@type": "Person", name: "Wren of the Vale" }],
      composer: [
        {
          "@type": "MusicGroup",
          name: "Northmarch Bards",
          url: `${ORIGIN}/bards/northmarch-bards`,
        },
      ],
    });
    expect(data).not.toHaveProperty("alternateName");
    expect(data).not.toHaveProperty("inLanguage");
  });

  it("names no one for credits that name no one", () => {
    const data = pieceStructuredData(
      piece({ credits: [credit("author", null)] })
    )(ORIGIN);
    expect(data).not.toHaveProperty("author");
    expect(data).not.toHaveProperty("composer");
  });
});

describe("personStructuredData", () => {
  it("describes a person with their other names and profiles", () => {
    expect(
      personStructuredData(
        personOf({
          profile: profileOf({
            aliases: [
              { name: "The Vale Sparrow", kind: "stage" },
              { name: "Wren V.", kind: "redirect" },
            ],
            links: [
              linkOf({ url: "https://wren.example/", roles: ["website"] }),
              linkOf({
                url: "https://hub.example/wren",
                roles: ["external_profile"],
              }),
              linkOf({ url: "https://other.example/", roles: ["lyrics"] }),
              linkOf({ url: "javascript:alert(1)", roles: ["website"] }),
            ],
          }),
        })
      )(ORIGIN)
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Wren of the Vale",
      alternateName: ["The Vale Sparrow"],
      url: `${ORIGIN}/bards/wren-of-the-vale`,
      sameAs: ["https://wren.example/", "https://hub.example/wren"],
    });
  });

  it("describes a group as a MusicGroup", () => {
    const data = personStructuredData(personOf({ kind: "group" }))(ORIGIN);
    expect(data["@type"]).toBe("MusicGroup");
    expect(data).not.toHaveProperty("sameAs");
    expect(data).not.toHaveProperty("alternateName");
  });
});
