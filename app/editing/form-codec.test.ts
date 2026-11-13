import { describe, expect, it } from "vitest";
import { decodeForm, fieldId } from "./form-codec";

const form = (fields: readonly (readonly [string, string])[]) =>
  new URLSearchParams(fields.map(([name, value]) => [name, value]));

describe("decodeForm", () => {
  it.each([
    [
      "a person: blank text is null, a ticked box is true",
      "person",
      [
        ["schema_version", "1"],
        ["name", "Wren of the Vale"],
        ["notes_md", "  "],
        ["is_stub", "on"],
      ],
      {
        schema_version: 1,
        name: "Wren of the Vale",
        kind: "community_bard",
        status: "active",
        notes_md: null,
        licensing_status: "unknown",
        licensing_notes_md: null,
        is_stub: true,
        aliases: [],
        roles: [],
        affiliation_slugs: [],
        links: [],
      },
    ],
    [
      "a collection: the defaults for what isn't posted",
      "collection",
      [
        ["name", "Songs"],
        ["url", "https://songs.example"],
      ],
      {
        schema_version: 1,
        name: "Songs",
        url: "https://songs.example",
        kind: "website",
        description_md: null,
        region_term_slug: null,
      },
    ],
    [
      "a term: a textarea's line breaks as \\n",
      "term",
      [
        ["name", "Tavern"],
        ["display_name", "Tavern"],
        ["position", "3"],
        ["description_md", "One\r\nTwo"],
      ],
      {
        schema_version: 1,
        facet: "topic",
        name: "Tavern",
        display_name: "Tavern",
        parent_slug: null,
        related_affiliation_slug: null,
        description_md: "One\nTwo",
        position: 3,
      },
    ],
  ] as const)("%s", (_why, type, fields, document) => {
    expect(decodeForm(type, form(fields))?.document).toEqual(document);
  });

  it("decodes a piece's nested rows: rows in index order, unticked boxes false, one checkbox a list, missing lists []", () => {
    const decoded = decodeForm(
      "piece",
      form([
        ["title", "The Copper Kettle"],
        ["conservation_status", "endangered"],
        ["term_slugs.1", "drinking"],
        ["term_slugs.0", "joyful"],
        ["credits.0.person_slug", ""],
        ["credits.0.attribution", "traditional"],
        ["links.0.url", "https://songs.example/kettle"],
        ["links.0.roles", "lyrics"],
        ["links.0.performances.0.year", "2019"],
        ["links.0.performances.0.performer_slugs.0", "wren-of-the-vale"],
        ["links.0.performances.0.performer_slugs.1", "northmarch-bards"],
      ])
    )?.document;
    expect(decoded).toMatchObject({
      title: "The Copper Kettle",
      is_stub: false,
      conservation_status: "endangered",
      aliases: [],
      term_slugs: ["joyful", "drinking"],
      credits: [
        {
          person_slug: null,
          role: "lyrics",
          attribution: "traditional",
          certainty: "certain",
        },
      ],
      links: [
        {
          url: "https://songs.example/kettle",
          collection_id: null,
          roles: ["lyrics"],
          performances: [
            {
              event_slug: null,
              year: 2019,
              uploader: null,
              description_verbatim: "",
              performer_slugs: ["wren-of-the-vale", "northmarch-bards"],
            },
          ],
        },
      ],
    });
  });

  it("refuses a value no select offers", () => {
    expect(decodeForm("term", form([["facet", "palace"]]))).toBeNull();
  });

  it("blanks a number that isn't whole, keeping the rest", () => {
    const decoded = decodeForm(
      "piece",
      form([
        ["title", "The Copper Kettle"],
        ["links.0.url", "https://songs.example/kettle"],
        ["links.0.performances.0.year", "1.5"],
      ])
    );
    expect(decoded?.document).toMatchObject({
      title: "The Copper Kettle",
      links: [{ performances: [{ year: null }] }],
    });
    expect(
      decodeForm("term", form([["position", "1.5"]]))?.document.position
    ).toBe(0);
  });

  it("ignores names that reach the prototype", () => {
    decodeForm("event", form([["__proto__.polluted", "yes"]]));
    expect({}).not.toHaveProperty("polluted");
  });
});

describe("fieldId", () => {
  it.each([
    ["title", "title"],
    ["credits[2].person_slug", "credits.2.person_slug"],
    ["links[0].performances[1].year", "links.0.performances.1.year"],
    ["aliases[3]", "aliases.3"],
  ])("%s is the control %s", (path, id) => {
    expect(fieldId(path)).toBe(id);
  });
});
