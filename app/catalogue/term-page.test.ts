import { expect, it } from "vitest";
import { categoryMeta, memberTotal } from "./term-page";

it("counts pieces for a piece facet and bards for an affiliation", () => {
  const topic = { facet: "topic", piece_count: 12, person_count: 0 } as const;
  const aff = {
    facet: "affiliation",
    piece_count: 0,
    person_count: 1,
  } as const;
  expect([memberTotal(topic), memberTotal(aff)]).toEqual([12, 1]);
  expect(categoryMeta(topic)).toBe("Topic · 12 pieces");
  expect(categoryMeta(aff)).toBe("Affiliation · 1 bard");
});
