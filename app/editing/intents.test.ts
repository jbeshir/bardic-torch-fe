import { describe, expect, it } from "vitest";
import { decodeForm } from "./form-codec";

// The row buttons without JavaScript: each intent, applied to the posted
// form, and the document it makes.

const BLANK_LINK = {
  url: "",
  title: null,
  description: null,
  platform: null,
  place_type: null,
  collection_id: null,
  locator: null,
  roles: [],
  performances: [],
};

const BLANK_PERFORMANCE = {
  event_slug: null,
  year: null,
  uploader: null,
  description_verbatim: "",
  performer_slugs: [],
};

describe("row intents", () => {
  it.each([
    ["add:aliases to none", [], "add:aliases", "aliases", [""]],
    [
      "add:aliases after one",
      [["aliases.0", "Inn songs"]],
      "add:aliases",
      "aliases",
      ["Inn songs", ""],
    ],
    [
      "remove:aliases.0 of two",
      [
        ["aliases.0", "Inn songs"],
        ["aliases.1", "Alehouse songs"],
      ],
      "remove:aliases.0",
      "aliases",
      ["Alehouse songs"],
    ],
    [
      "add:links (a blank row of every default)",
      [],
      "add:links",
      "links",
      [BLANK_LINK],
    ],
    [
      "add:links.0.performances (nested)",
      [["links.0.url", "https://songs.example"]],
      "add:links.0.performances",
      "links",
      [
        {
          ...BLANK_LINK,
          url: "https://songs.example",
          performances: [BLANK_PERFORMANCE],
        },
      ],
    ],
    [
      "remove:links.0.performances.0",
      [
        ["links.0.url", "https://songs.example"],
        ["links.0.performances.0.year", "2019"],
      ],
      "remove:links.0.performances.0",
      "links",
      [{ ...BLANK_LINK, url: "https://songs.example" }],
    ],
  ] as const)("%s", (_why, fields, intent, list, rows) => {
    const type = list === "aliases" ? "term" : "piece";
    const decoded = decodeForm(
      type,
      new URLSearchParams([
        ...fields.map(([name, value]): [string, string] => [name, value]),
        ["intent", intent],
      ])
    );
    expect(decoded?.document).toMatchObject({ [list]: rows });
  });

  it.each([
    ["submit", "submit"],
    ["preview", "preview"],
    ["no intent (Enter)", null],
    ["an intent we don't know", "delete:everything"],
  ])("%s is a %s", (_why, intent) => {
    const fields = new URLSearchParams(intent ? [["intent", intent]] : []);
    expect(decodeForm("event", fields)?.intent.kind).toBe(
      intent === "submit" ? "submit" : "preview"
    );
  });
});
