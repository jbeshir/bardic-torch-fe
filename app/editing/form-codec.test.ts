import { describe, expect, it } from "vitest";
import { decodeForm, fieldId } from "./form-codec";

const form = (fields: readonly (readonly [string, string])[]) =>
  new URLSearchParams(fields.map(([name, value]) => [name, value]));

describe("decodeForm", () => {
  it.each([
    [
      "an event: blank text is null",
      "event",
      [
        ["schema_version", "1"],
        ["name", "Midwinter Revel"],
        ["kind", "venue"],
        ["description_md", "  "],
      ],
      {
        schema_version: 1,
        name: "Midwinter Revel",
        kind: "venue",
        description_md: null,
      },
    ],
    [
      "a collection: a ticked box is true, a blank number null, a typed one a number",
      "collection",
      [
        ["name", "Songs"],
        ["is_bardic_resource", "on"],
        ["parent_id", ""],
        ["url", "https://songs.example"],
      ],
      {
        schema_version: 1,
        name: "Songs",
        url: "https://songs.example",
        kind: "other",
        description_md: null,
        region_term_slug: null,
        parent_id: null,
        is_bardic_resource: true,
        enumerable: "unknown",
      },
    ],
    [
      "a term: rows by index, in index order, and a textarea's line breaks as \\n",
      "term",
      [
        ["name", "Tavern"],
        ["display_name", "Tavern"],
        ["position", "3"],
        ["aliases.1", "Inn songs"],
        ["aliases.0", "Alehouse songs"],
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
        aliases: ["Alehouse songs", "Inn songs"],
      },
    ],
  ] as const)("%s", (_why, type, fields, document) => {
    expect(decodeForm(type, form(fields))?.document).toEqual(document);
  });

  it("decodes a piece's nested rows: unticked boxes false, one checkbox a list, missing lists []", () => {
    const decoded = decodeForm(
      "piece",
      form([
        ["title", "The Copper Kettle"],
        ["conservation.status", "endangered"],
        ["conservation.source_url", "https://survey.example"],
        ["credits.0.person_slug", ""],
        ["credits.0.attribution", "traditional"],
        ["links.0.url", "https://songs.example/kettle"],
        ["links.0.roles", "lyrics"],
        ["links.0.performances.0.year", "2019"],
        ["links.0.performances.0.performer_slugs", "wren-of-the-vale"],
        ["links.0.performances.0.performer_slugs", "northmarch-bards"],
      ])
    )?.document;
    expect(decoded).toMatchObject({
      title: "The Copper Kettle",
      is_stub: false,
      conservation: {
        status: "endangered",
        source_url: "https://survey.example",
      },
      aliases: [],
      terms: [],
      credits: [
        {
          person_slug: null,
          role: "lyrics",
          attribution: "traditional",
          certainty: "certain",
          part: null,
          note: null,
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

  it.each([
    ["a value no select offers", [["facet", "palace"]]],
    ["a number that isn't whole", [["position", "1.5"]]],
  ] as const)("refuses %s", (_why, fields) => {
    expect(decodeForm("term", form(fields))).toBeNull();
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
