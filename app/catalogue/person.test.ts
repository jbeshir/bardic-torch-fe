import { describe, expect, it } from "vitest";
import { personStatus } from "./person";

describe("personStatus", () => {
  it.each([
    ["community_bard", "deceased", "1544-06-01", "Died 1 Jun 1544"],
    ["group", "deceased", null, "Disbanded"],
    ["group", "active", null, null],
    ["community_bard", "prefers_no_page", "2026-03-01", null],
  ] as const)("%s %s %s is %s", (kind, status, date, label) => {
    expect(personStatus({ kind, status, status_date: date })).toBe(label);
  });
});
