import { describe, expect, it } from "vitest";
import { personOf, profileOf } from "~/test/catalogue";
import { personStatus, personSubtitle } from "./person";

describe("personStatus", () => {
  it.each([
    ["community_bard", "1544-06-01", "Died 1 Jun 1544"],
    ["historical", "1198-01-01", "Died 1 Jan 1198"],
    ["group", "2019-09-01", "Disbanded 1 Sep 2019"],
    ["community_bard", null, "Died"],
    ["group", null, "Disbanded"],
  ] as const)("says a deceased %s with %s is “%s”", (kind, date, label) => {
    expect(personStatus({ kind, status: "deceased", status_date: date })).toBe(
      label
    );
  });

  it("says nothing for an active person, or one with no page", () => {
    expect(
      personStatus({ kind: "group", status: "active", status_date: null })
    ).toBeNull();
    expect(
      personStatus({
        kind: "community_bard",
        status: "prefers_no_page",
        status_date: "2026-03-01",
      })
    ).toBeNull();
  });
});

describe("personSubtitle", () => {
  it("is the kind, the pronouns and the status", () => {
    expect(
      personSubtitle(
        personOf({
          status: "deceased",
          status_date: "2026-10-03",
          profile: profileOf({ pronouns: "she/her" }),
        })
      )
    ).toBe("Community bard · she/her · Died 3 Oct 2026");
  });

  it("is the kind alone for a person with no page", () => {
    expect(
      personSubtitle(
        personOf({
          kind: "historical",
          status: "prefers_no_page",
          profile: null,
        })
      )
    ).toBe("Historical figure");
  });
});
