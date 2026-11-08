import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { EntityPage } from "./EntityPage";

describe("EntityPage", () => {
  it("has the Read and History views, Read current on the Read address", async () => {
    await renderWithRouter(
      <EntityPage path="/bards/wren-of-the-vale" title="Wren of the Vale">
        <p>About Wren.</p>
      </EntityPage>,
      "/bards/wren-of-the-vale"
    );
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(within(views).getByRole("link", { name: "Read" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale/history");
  });

  it("marks History current on the History address", async () => {
    await renderWithRouter(
      <EntityPage path="/pieces/x" title="X">
        <p>Revisions.</p>
      </EntityPage>,
      "/pieces/x/history"
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("is the single Read label without the history", async () => {
    await renderWithRouter(
      <EntityPage path="/bards/hollis-fenn" title="Hollis Fenn" history={false}>
        <p>Nothing here.</p>
      </EntityPage>,
      "/bards/hollis-fenn"
    );
    expect(screen.queryByRole("navigation", { name: "Page views" })).toBeNull();
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
    expect(screen.getByText("Read")).toHaveAttribute("aria-current", "page");
  });

  it("puts the subtitle under the h1 and the banners under the title rule", async () => {
    await renderWithRouter(
      <EntityPage
        path="/pieces/x"
        title="X"
        subtitle="Song · 1580"
        banners={<p>A banner</p>}
      >
        <p>The prose.</p>
      </EntityPage>,
      "/pieces/x"
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "X" });
    const subtitle = screen.getByText("Song · 1580");
    const tabs = screen.getByTestId("view-tabs");
    const banner = screen.getByText("A banner");
    const prose = screen.getByText("The prose.");
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(h1, subtitle)).toBe(true);
    expect(follows(subtitle, tabs)).toBe(true);
    expect(follows(tabs, banner)).toBe(true);
    expect(follows(banner, prose)).toBe(true);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <EntityPage path="/pieces/x" title="X" subtitle="Song">
          <p>The prose.</p>
        </EntityPage>,
        "/pieces/x"
      )
    );
  });
});
