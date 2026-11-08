import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ListPagination } from "./ListPagination";

const href = (n: number) => (n > 1 ? `/pieces?page=${n}` : "/pieces");

describe("ListPagination", () => {
  it("shows nothing for one page", async () => {
    await renderWithRouter(<ListPagination page={1} total={50} href={href} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });

  it("pages the list", async () => {
    await renderWithRouter(<ListPagination page={2} total={249} href={href} />);
    expect(
      screen.getByRole("navigation", { name: "Pagination" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Page 5" })).toHaveAttribute(
      "href",
      "/pieces?page=5"
    );
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/pieces"
    );
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });

  it("stops at page 201 and says the rest can't be shown", async () => {
    await renderWithRouter(
      <ListPagination page={1} total={10_051} href={href} />
    );
    expect(screen.getByRole("link", { name: "Page 201" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Page 202" })).toBeNull();
    expect(
      screen.getByText(
        "Showing the first 10,050. Narrow your search to see the rest."
      )
    ).toBeVisible();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ListPagination page={3} total={20_000} href={href} />)
    );
  });
});
