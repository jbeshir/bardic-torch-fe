import { describe, expect, it } from "vitest";
import {
  categoryMeta,
  categoryPath,
  memberCount,
  memberTotal,
} from "./term-page";

describe("a category's members", () => {
  const topic = { facet: "topic", piece_count: 12, person_count: 0 } as const;
  const affiliation = {
    facet: "affiliation",
    piece_count: 0,
    person_count: 1,
  } as const;

  it("are pieces for a piece facet and bards for an affiliation", () => {
    expect(memberTotal(topic)).toBe(12);
    expect(memberTotal(affiliation)).toBe(1);
    expect(memberCount(topic)).toBe("12 pieces");
    expect(memberCount(affiliation)).toBe("1 bard");
  });

  it("make the meta line", () => {
    expect(categoryMeta(topic)).toBe("Topic · 12 pieces");
    expect(categoryMeta(affiliation)).toBe("Affiliation · 1 bard");
  });

  it("live at the category's path", () => {
    expect(categoryPath("swords")).toBe("/categories/swords");
  });
});
