import { describe, expect, it } from "vitest";
import {
  linkExposure,
  LINK_NOT_SHOWN,
  withoutRestrictedLink,
  withoutRestrictedRecording,
} from "./restricted";

describe("linkExposure (plan §4.0)", () => {
  it("keeps a restricted piece's links to its own page", () => {
    expect(linkExposure({ conservation_status: "restricted" })).toBe(
      "internal-only"
    );
    expect(LINK_NOT_SHOWN).toBe("Link not shown: see the piece page");
  });

  it.each([
    "unassessed",
    "low_risk",
    "endangered",
    "critically_endangered",
  ] as const)("shows a %s piece's links", status => {
    expect(linkExposure({ conservation_status: status })).toBe("full");
  });

  it("shows a link beside no piece", () => {
    expect(linkExposure(null)).toBe("full");
  });
});

describe("withoutRestrictedLink", () => {
  const row = {
    piece: { conservation_status: "restricted" as const },
    url: "https://private.example/hoard",
    title: "The text",
    locator: "p. 31",
  };

  it("empties a restricted piece's link, keeping the rest", () => {
    expect(withoutRestrictedLink(row)).toEqual({
      ...row,
      url: "",
      title: null,
    });
  });

  it("keeps every other link", () => {
    const open = {
      ...row,
      piece: { conservation_status: "low_risk" as const },
    };
    expect(withoutRestrictedLink(open)).toBe(open);
    const noPiece = { ...row, piece: null };
    expect(withoutRestrictedLink(noPiece)).toBe(noPiece);
  });
});

describe("withoutRestrictedRecording", () => {
  const performance = {
    piece: { conservation_status: "restricted" as const },
    link: {
      url: "https://private.example/hoard",
      title: "Live",
      platform: "Videohall",
    },
    year: 2026,
  };

  it("empties a restricted piece's recording, keeping the rest", () => {
    expect(withoutRestrictedRecording(performance)).toEqual({
      ...performance,
      link: { url: "", title: null, platform: null },
    });
  });

  it("keeps every other recording", () => {
    const open = {
      ...performance,
      piece: { conservation_status: "endangered" as const },
    };
    expect(withoutRestrictedRecording(open)).toBe(open);
    const noPiece = { ...performance, piece: null };
    expect(withoutRestrictedRecording(noPiece)).toBe(noPiece);
  });
});
