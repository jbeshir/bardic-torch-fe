import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { RevisionDiff } from "./RevisionDiff";

const ROW = {
  field: "title",
  label: "Title",
  diff: {
    kind: "scalar",
    before: [{ kind: "text", text: "Old" }],
    after: [{ kind: "text", text: "New" }],
  },
} as const;

describe("RevisionDiff", () => {
  it("lists the changes under “Changes”", async () => {
    await renderWithRouter(
      <RevisionDiff
        changes={{ first: false, linksAsText: false, rows: [ROW] }}
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Changes" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 3, name: "Title" })
    ).toBeVisible();
  });

  it("says what a first version set", async () => {
    await renderWithRouter(
      <RevisionDiff
        changes={{ first: true, linksAsText: false, rows: [ROW] }}
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "First recorded version" })
    ).toBeVisible();
    expect(
      screen.getByText("These are the fields this revision set.")
    ).toBeVisible();
  });

  it("says why a restricted piece's links are text", async () => {
    await renderWithRouter(
      <RevisionDiff changes={{ first: false, linksAsText: true, rows: [] }} />
    );
    expect(screen.getByText(/its links are shown as text only/)).toBeVisible();
    expect(
      screen.getByText("Nothing that is still shown changed in this revision.")
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <RevisionDiff
          changes={{ first: false, linksAsText: false, rows: [ROW] }}
        />
      )
    );
  });
});
