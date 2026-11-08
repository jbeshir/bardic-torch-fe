import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RevisionSummary } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { RevisionHistory } from "./RevisionHistory";

const USER: RevisionSummary = {
  id: 1011,
  source: "user",
  summary: "Set the region",
  author: { display_name: "Morwen of the Marches" },
  contributors: [],
  created_at: "2026-03-10T12:00:00Z",
};

const IMPORT: RevisionSummary = {
  id: 1010,
  source: "import",
  summary: "",
  author: null,
  contributors: ["Archivist", "Lorekeeper"],
  created_at: "2025-01-10T12:00:00Z",
};

const table = () => screen.getByRole("table", { name: "Revisions" });

describe("RevisionHistory", () => {
  it("lists when, who, the summary and the link to the changes", async () => {
    await renderWithRouter(<RevisionHistory revisions={[USER, IMPORT]} />);
    const [, user, imported] = within(table()).getAllByRole("row");
    if (!user || !imported) throw new Error("rows missing");
    const when = within(user).getByText("10 Mar 2026");
    expect(when.tagName).toBe("TIME");
    expect(when).toHaveAttribute("datetime", "2026-03-10T12:00:00Z");
    expect(user).toHaveTextContent("Morwen of the Marches");
    expect(user).toHaveTextContent("Set the region");
    expect(
      within(user).getByRole("link", {
        name: /^View changes ?, revision 1011$/,
      })
    ).toHaveAttribute("href", "/revisions/1011");
    expect(imported).toHaveTextContent(
      "Imported from the original wiki, by Archivist and Lorekeeper"
    );
    expect(within(imported).getByText("No summary")).toHaveClass(
      "text-fg-subtle"
    );
  });

  it("says when there is no history yet", async () => {
    await renderWithRouter(<RevisionHistory revisions={[]} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "No history yet" })
    ).toBeVisible();
    expect(
      screen.getByText("Changes to this page will be listed here.")
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<RevisionHistory revisions={[USER, IMPORT]} />)
    );
  });
});
