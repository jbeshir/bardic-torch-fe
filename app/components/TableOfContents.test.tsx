import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { TableOfContents } from "./TableOfContents";

const ENTRIES = [
  { id: "low-risk", label: "Low risk" },
  {
    id: "endangered",
    label: "Endangered",
    children: [
      { id: "three-places", label: "Exactly three places" },
      { id: "fewer", label: "Fewer than three" },
    ],
  },
  { id: "restricted", label: "Restricted" },
  { id: "not-assessed", label: "Not yet assessed" },
];

function viewport(wide: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => {
    expect(query).toBe("(min-width: 768px)");
    return { matches: wide };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TableOfContents", () => {
  it("is a Contents nav with numbered links to each h2 and h3", async () => {
    viewport(true);
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["1Low risk", "#low-risk"],
      ["2Endangered", "#endangered"],
      ["2.1Exactly three places", "#three-places"],
      ["2.2Fewer than three", "#fewer"],
      ["3Restricted", "#restricted"],
      ["4Not yet assessed", "#not-assessed"],
    ]);
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).toHaveClass("inline-flex", "min-h-6");
    }
  });

  it("stays open from md", async () => {
    viewport(true);
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    expect(document.querySelector("details")).toHaveProperty("open", true);
  });

  it("folds itself below md once JS runs", async () => {
    viewport(false);
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    expect(document.querySelector("details")).toHaveProperty("open", false);
    expect(
      screen.getByRole("navigation", { name: "Contents" })
    ).toBeInTheDocument();
  });

  it("keeps the reader's choice when the window is resized", async () => {
    viewport(false);
    const user = userEvent.setup();
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    await user.click(screen.getByText("Contents"));
    viewport(true);
    window.dispatchEvent(new Event("resize"));
    expect(document.querySelector("details")).toHaveProperty("open", true);
    await user.click(screen.getByText("Contents"));
    viewport(false);
    window.dispatchEvent(new Event("resize"));
    expect(document.querySelector("details")).toHaveProperty("open", false);
  });

  it("is its own block, so it narrows beside a floated infobox", async () => {
    viewport(true);
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    expect(screen.getByRole("navigation", { name: "Contents" })).toHaveClass(
      "flow-root"
    );
  });

  it("right-aligns its numbers in a fixed column, so 10 lines up with 9", async () => {
    viewport(true);
    await renderWithRouter(<TableOfContents entries={ENTRIES} />);
    const number = screen.getByText("2.1");
    expect(number).toHaveClass("min-w-6", "text-right", "tabular-nums");
  });

  it("looks the same in both themes", async () => {
    viewport(true);
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<TableOfContents entries={ENTRIES} />)
    );
  });
});
