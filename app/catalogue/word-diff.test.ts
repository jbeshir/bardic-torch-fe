import { describe, expect, it } from "vitest";
import { wordDiff, type WordPart } from "./word-diff";

const side = (parts: readonly WordPart[], kind: "added" | "removed") =>
  parts
    .filter(part => part.kind === "same" || part.kind === kind)
    .map(part => part.text)
    .join("");

describe("wordDiff", () => {
  it("marks the words removed and added between kept ones", () => {
    expect(wordDiff("the old copper kettle", "the new copper kettle")).toEqual([
      { kind: "same", text: "the " },
      { kind: "removed", text: "old " },
      { kind: "added", text: "new " },
      { kind: "same", text: "copper kettle" },
    ]);
  });

  it.each([
    ["", "All new."],
    ["- one\n- two\n\nThen *more*.", "- one\n- three\n- two\n\nThen *more*!"],
    ["  leading space", "leading space  "],
  ])("puts both texts back exactly: %j → %j", (before, after) => {
    const parts = wordDiff(before, after);
    if (parts === null) throw new Error("no diff");
    expect(side(parts, "removed")).toBe(before);
    expect(side(parts, "added")).toBe(after);
  });

  it("gives up on two 10,000-word texts, fast", () => {
    const words = (seed: string) =>
      Array.from({ length: 10_000 }, (_, i) => `${seed}${i}`).join(" ");
    const start = performance.now();
    expect(wordDiff(words("a"), words("b"))).toBeNull();
    expect(performance.now() - start).toBeLessThan(500);
  });
});
