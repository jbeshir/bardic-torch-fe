import { describe, expect, it } from "vitest";
import { personStatus } from "./person";

describe("personStatus", () => {
  it.each([
    ["community_bard", "deceased", "Died"],
    ["group", "deceased", "Disbanded"],
    ["group", "active", null],
    ["community_bard", "prefers_no_page", null],
  ] as const)("%s %s is %s", (kind, status, label) => {
    expect(personStatus({ kind, status })).toBe(label);
  });
});
