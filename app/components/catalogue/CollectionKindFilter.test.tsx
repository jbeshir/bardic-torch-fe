import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { collectionQuery } from "~/catalogue/query-state";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { CollectionKindFilter } from "./CollectionKindFilter";

function renderFilter(search: string) {
  const { state } = collectionQuery.parse(new URLSearchParams(search));
  return renderRoutes(
    [
      {
        path: "/collections",
        element: <CollectionKindFilter state={state} />,
        HydrateFallback: () => null,
      },
    ],
    `/collections${search}`
  );
}

describe("CollectionKindFilter", () => {
  it("is closed with nothing chosen, open with the chosen kinds ticked", async () => {
    await renderFilter("");
    expect(
      screen.getByText("Filter by kind").closest("details")
    ).not.toHaveAttribute("open");
  });

  it("shows a chevron on the summary, which the keyboard reaches", async () => {
    await renderFilter("");
    const user = userEvent.setup();
    const summary = screen.getByText("Filter by kind").closest("summary");
    expect(summary?.querySelector("svg")).toBeInTheDocument();
    await user.tab();
    expect(summary).toHaveFocus();
  });

  it("opens on a chosen kind, saying how many", async () => {
    await renderFilter("?kind=blog&letter=C");
    const details = screen.getByText(/Filter by kind/).closest("details");
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Filter by kind (1 selected)")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Blog" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Wiki" })).not.toBeChecked();
    // The letter rides along; the page doesn't.
    expect(
      document.querySelector('input[type="hidden"][name="letter"]')
    ).toHaveValue("C");
  });

  it("goes straight to the canonical URL on Apply, from the keyboard", async () => {
    const router = await renderFilter("?kind=blog&letter=C");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Wiki" }));
    screen.getByRole("button", { name: "Apply filters" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toBe("?kind=wiki&kind=blog&letter=C");
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderFilter("?kind=wiki"));
  });
});
