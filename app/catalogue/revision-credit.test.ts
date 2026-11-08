import { describe, expect, it } from "vitest";
import { revisionCredit } from "./revision-credit";

const author = { display_name: "Morwen of the Marches" };

describe("revisionCredit (plan §4.11)", () => {
  it("names a user's revision by its author", () => {
    expect(revisionCredit({ source: "user", author, contributors: [] })).toBe(
      "Morwen of the Marches"
    );
  });

  it("says when a revision came through the MCP tool", () => {
    expect(revisionCredit({ source: "mcp", author, contributors: [] })).toBe(
      "Morwen of the Marches (via the MCP tool)"
    );
  });

  it.each([
    [[], "Imported from the original wiki"],
    [["Lorekeeper"], "Imported from the original wiki, by Lorekeeper"],
    [
      ["Archivist", "Lorekeeper"],
      "Imported from the original wiki, by Archivist and Lorekeeper",
    ],
    [
      ["Archivist", "Lorekeeper", "Quill"],
      "Imported from the original wiki, by Archivist, Lorekeeper and Quill",
    ],
  ])("credits an import's wiki contributors %j", (contributors, credit) => {
    expect(
      revisionCredit({ source: "import", author: null, contributors })
    ).toBe(credit);
  });

  it("says Unknown for an author the API doesn't show", () => {
    expect(
      revisionCredit({ source: "user", author: null, contributors: [] })
    ).toBe("Unknown");
  });
});
