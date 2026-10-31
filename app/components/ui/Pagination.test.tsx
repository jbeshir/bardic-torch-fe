import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Pagination } from "./Pagination";

const href = (n: number) => `/pieces?page=${n}`;

function numbers() {
  return within(screen.getByRole("navigation", { name: "Pagination" }))
    .getAllByRole("listitem")
    .filter(item => item.classList.contains("sm:block"))
    .map(item => item.textContent);
}

describe("Pagination", () => {
  it("is a Pagination nav: first, last, the current page and its neighbours", async () => {
    await renderWithRouter(<Pagination page={6} pageCount={12} href={href} />);
    expect(numbers()).toEqual([
      "Page 1",
      "…more pages",
      "Page 5",
      "Page 6",
      "Page 7",
      "…more pages",
      "Page 12",
    ]);
  });

  it("shows a lone left-out page instead of a gap", async () => {
    await renderWithRouter(<Pagination page={4} pageCount={6} href={href} />);
    expect(numbers()).toEqual([
      "Page 1",
      "Page 2",
      "Page 3",
      "Page 4",
      "Page 5",
      "Page 6",
    ]);
  });

  it("shows the current page as text on the accent fill, never focusable", async () => {
    await renderWithRouter(<Pagination page={3} pageCount={12} href={href} />);
    const current = screen.getByText("3", { selector: "span" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("bg-accent", "text-accent-fg", "font-semibold");
    expect(current.closest("a")).toBeNull();
  });

  it("links the other pages with 44 px targets", async () => {
    await renderWithRouter(<Pagination page={3} pageCount={12} href={href} />);
    const link = screen.getByRole("link", { name: "Page 4" });
    expect(link).toHaveAttribute("href", "/pieces?page=4");
    expect(link).toHaveClass("min-h-11", "min-w-11");
  });

  it("hides the gap's ellipsis from screen readers and names it", async () => {
    await renderWithRouter(<Pagination page={1} pageCount={12} href={href} />);
    const gap = screen.getByText("…");
    expect(gap).toHaveAttribute("aria-hidden", "true");
    expect(gap.nextElementSibling).toHaveTextContent("more pages");
    expect(gap.nextElementSibling).toHaveClass("sr-only");
  });

  it("links Previous and Next with rel, and disables them at the ends", async () => {
    await renderWithRouter(<Pagination page={1} pageCount={3} href={href} />);
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    const previous = screen.getByText("Previous");
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveClass("text-fg-subtle", "bg-surface-sunken");
    const next = screen.getByRole("link", { name: "Next" });
    expect(next).toHaveAttribute("href", "/pieces?page=2");
    expect(next).toHaveAttribute("rel", "next");
  });

  it("disables Next on the last page", async () => {
    await renderWithRouter(<Pagination page={3} pageCount={3} href={href} />);
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "rel",
      "prev"
    );
  });

  it("below sm swaps the numbers for 'Page 3 of 12'", async () => {
    await renderWithRouter(<Pagination page={3} pageCount={12} href={href} />);
    expect(screen.getByText("Page 3 of 12")).toHaveClass("sm:hidden");
    for (const item of screen.getAllByRole("listitem")) {
      const isStep = /Previous|Next|of 12/.test(item.textContent ?? "");
      if (!isStep) expect(item).toHaveClass("hidden", "sm:block");
    }
  });

  it("moves between pages from the keyboard in reading order", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <Pagination page={2} pageCount={3} href={href} />,
      "/pieces?page=2"
    );
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Previous" })).toHaveFocus();
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Page 1" })).toHaveFocus();
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.search).toBe("?page=3");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<Pagination page={6} pageCount={12} href={href} />)
    );
  });
});
