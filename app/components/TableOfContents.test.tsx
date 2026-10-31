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

  it("looks the same in both themes", async () => {
    viewport(true);
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<TableOfContents entries={ENTRIES} />)
    );
  });
});
