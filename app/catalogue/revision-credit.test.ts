import { describe, expect, it } from "vitest";
import { revisionCredit } from "./revision-credit";

const author = { display_name: "Morwen of the Marches" };

describe("revisionCredit", () => {
  it.each([
    ["user", author, [], "Morwen of the Marches"],
    ["import", null, [], "Imported from the original wiki"],
    [
      "import",
      null,
      ["Archivist", "Lorekeeper", "Quill"],
      "Imported from the original wiki, by Archivist, Lorekeeper and Quill",
    ],
    ["user", null, [], "Unknown"],
  ] as const)("%s by %o with %j is %s", (source, by, contributors, credit) => {
    expect(
      revisionCredit({ source, author: by, contributors: [...contributors] })
    ).toBe(credit);
  });
});
