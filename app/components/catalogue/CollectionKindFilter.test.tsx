import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { collectionQuery } from "~/catalogue/query-state";
import { renderRoutes } from "~/test/router";
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
  it("goes straight to the canonical URL on Apply, from the keyboard", async () => {
    const router = await renderFilter("?kind=blog&letter=C");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Wiki" }));
    screen.getByRole("button", { name: "Apply filters" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toBe("?kind=wiki&kind=blog&letter=C");
  });
});
