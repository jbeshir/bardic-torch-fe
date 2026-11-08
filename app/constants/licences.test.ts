import { describe, expect, it } from "vitest";
import { CC_LICENCES_URL, isCreativeCommons } from "./licences";

describe("licences", () => {
  it("tells the Creative Commons licences from the rest", () => {
    expect(
      (["pd", "cc_by", "cc_by_nc_nd", "arr", "other"] as const).filter(
        isCreativeCommons
      )
    ).toEqual(["cc_by", "cc_by_nc_nd"]);
  });

  it("links the family overview, never a versioned deed", () => {
    expect(CC_LICENCES_URL).toBe("https://creativecommons.org/licenses/");
  });
});
