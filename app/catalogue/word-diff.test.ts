import { describe, expect, it } from "vitest";
import { wordDiff, type WordPart } from "./word-diff";

/** The text a side of the diff puts back together. */
function side(parts: readonly WordPart[], kind: "added" | "removed"): string {
  return parts
    .filter(part => part.kind === "same" || part.kind === kind)
    .map(part => part.text)
    .join("");
}

describe("wordDiff (plan §4.11)", () => {
  it("marks the words removed and added between kept ones", () => {
    expect(wordDiff("the old copper kettle", "the new copper kettle")).toEqual([
      { kind: "same", text: "the " },
      { kind: "removed", text: "old " },
      { kind: "added", text: "new " },
      { kind: "same", text: "copper kettle" },
    ]);
  });

  it("is the same text throughout when nothing changed", () => {
    expect(wordDiff("Sung at feasts.", "Sung at feasts.")).toEqual([
      { kind: "same", text: "Sung at feasts." },
    ]);
  });

  it.each([
    ["", "All new."],
    ["All gone.", ""],
    ["- one\n- two\n\nThen *more*.", "- one\n- three\n- two\n\nThen *more*!"],
    ["  leading space", "leading space  "],
  ])("puts both texts back exactly: %j → %j", (before, after) => {
    const parts = wordDiff(before, after);
    if (parts === null) throw new Error("no diff");
    expect(side(parts, "removed")).toBe(before);
    expect(side(parts, "added")).toBe(after);
  });

  it("diffs a 1,000-word edit word by word", () => {
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
    const edited = words.map((word, i) => (i % 10 === 0 ? `x${i}` : word));
    const parts = wordDiff(words.join(" "), edited.join(" "));
    if (parts === null) throw new Error("no diff");
    expect(parts.filter(p => p.kind === "added")).toHaveLength(100);
    expect(side(parts, "added")).toBe(edited.join(" "));
  });

  it("gives up on two 10,000-word texts, fast", () => {
    const words = (seed: string) =>
      Array.from({ length: 10_000 }, (_, i) => `${seed}${i}`).join(" ");
    const start = performance.now();
    expect(wordDiff(words("a"), words("b"))).toBeNull();
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("gives up past 500 edits, within its bound", () => {
    const a = Array.from({ length: 1400 }, (_, i) => `a${i}`).join(" ");
    const b = Array.from({ length: 1400 }, (_, i) => `b${i}`).join(" ");
    const start = performance.now();
    expect(wordDiff(a, b)).toBeNull();
    expect(performance.now() - start).toBeLessThan(500);
  });
});
