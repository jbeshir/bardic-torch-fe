import { describe, expect, it } from "vitest";
import {
  linkExposure,
  withoutRestrictedLink,
  withoutRestrictedRecording,
} from "./restricted";

const restricted = { conservation_status: "restricted" as const };
const open = { conservation_status: "low_risk" as const };

describe("restricted pieces", () => {
  it.each([
    [restricted, "internal-only"],
    [open, "full"],
    [null, "full"],
  ] as const)("%o exposes links as %s", (piece, expected) => {
    expect(linkExposure(piece)).toBe(expected);
  });

  it("empties a restricted piece's link and recording, keeping every other", () => {
    const link = { piece: restricted, url: "https://x.example", title: "T" };
    expect(withoutRestrictedLink(link)).toEqual({
      ...link,
      url: "",
      title: null,
    });
    const row = { piece: open, url: "https://x.example", title: "T" };
    expect(withoutRestrictedLink(row)).toBe(row);

    const rec = {
      piece: restricted,
      link: { url: "https://x.example", title: "Live", platform: "Videohall" },
    };
    expect(withoutRestrictedRecording(rec).link).toEqual({
      url: "",
      title: null,
      platform: null,
    });
    const other = { ...rec, piece: null };
    expect(withoutRestrictedRecording(other)).toBe(other);
  });
});
