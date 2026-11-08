import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { EntityPage } from "./EntityPage";

function page(url: string) {
  return renderWithRouter(
    <EntityPage
      path="/categories/swords"
      title="Swords"
      subtitle="Topic · 2 pieces"
      breadcrumbs={{
        trail: [{ label: "Categories", to: "/categories" }],
        current: "Swords",
      }}
    >
      <p>Body</p>
    </EntityPage>,
    url
  );
}

describe("EntityPage", () => {
  it("has the Read and History views, Read current on the Read path", async () => {
    await page("/categories/swords");
    expect(
      screen.getByRole("heading", { level: 1, name: "Swords" })
    ).toBeVisible();
    expect(screen.getByText("Topic · 2 pieces")).toBeVisible();
    const views = screen.getByRole("navigation", { name: /views/i });
    expect(within(views).getByRole("link", { name: "Read" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("href", "/categories/swords/history");
  });

  it("marks History current on the history path", async () => {
    await page("/categories/swords/history");
    const views = screen.getByRole("navigation", { name: /views/i });
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("moves between the views with the keyboard", async () => {
    await page("/categories/swords");
    const user = userEvent.setup();
    const history = screen.getByRole("link", { name: "History" });
    history.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => page("/categories/swords"));
  });
});
