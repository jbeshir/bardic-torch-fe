import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Letter } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { LetterBar } from "./LetterBar";

const LETTERS = (["0", "A", "B", "T", "W"] as const).map(letter => ({
  letter,
  count: 2,
}));
const href = (letter: Letter | undefined) =>
  letter ? `/pieces?letter=${letter}` : "/pieces";

function renderBar(current: Letter | undefined) {
  return renderWithRouter(
    <LetterBar
      label="Pieces by letter"
      letters={LETTERS}
      current={current}
      href={href}
    />
  );
}

const cells = () =>
  within(screen.getByRole("navigation", { name: "Pieces by letter" }))
    .getAllByRole("listitem")
    .map(item => item.textContent);

describe("LetterBar", () => {
  it("has All, then 0 and A to Z", async () => {
    await renderBar(undefined);
    const all = cells();
    expect(all).toHaveLength(28);
    expect(all.slice(0, 4)).toEqual(["All", "0–90–9 and others", "A", "B"]);
    expect(all.at(-1)).toBe("Z");
  });

  it("names 0 for what it holds", async () => {
    await renderBar(undefined);
    expect(
      screen.getByRole("link", { name: "0–9 and others" })
    ).toHaveAttribute("href", "/pieces?letter=0");
  });

  it("links the letters with entries and leaves the others as text", async () => {
    await renderBar(undefined);
    expect(screen.getByRole("link", { name: "T" })).toHaveAttribute(
      "href",
      "/pieces?letter=T"
    );
    expect(screen.queryByRole("link", { name: "Q" })).toBeNull();
    const q = screen.getByText("Q");
    expect(q).toHaveAttribute("aria-disabled", "true");
    expect(q).toHaveClass("text-fg-subtle", "cursor-not-allowed");
  });

  it("marks All current when no letter is chosen", async () => {
    await renderBar(undefined);
    const all = screen.getByText("All");
    expect(all).toHaveAttribute("aria-current", "page");
    expect(all.closest("a")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(LETTERS.length);
  });

  it("marks the current letter, and links All back to the whole list", async () => {
    await renderBar("T");
    const t = screen.getByText("T");
    expect(t).toHaveAttribute("aria-current", "page");
    expect(t).toHaveClass("bg-accent", "text-accent-fg");
    expect(t.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/pieces"
    );
  });

  it("styles each state as DESIGN §6.29 says: idle, hover, focus, empty and current", async () => {
    await renderBar("T");
    const link = screen.getByRole("link", { name: "A" });
    // Idle: link colour, no fill; hover: the sunken wash and the hover
    // colour; focus: the shared ring, inset in this dense row.
    expect(link).toHaveClass(
      "font-medium",
      "text-link",
      "hover:bg-surface-sunken",
      "hover:text-link-hover",
      "focus-visible:-outline-offset-2"
    );
    expect(link.className).not.toMatch(/(^|\s)bg-/);
    // Empty: the same weight, subtle, with no fill, hover or ring.
    const empty = screen.getByText("Q");
    expect(empty).toHaveClass(
      "font-medium",
      "text-fg-subtle",
      "cursor-not-allowed"
    );
    expect(empty.className).not.toMatch(/bg-|hover:|outline/);
    // Current: the accent fill, never focusable, so no ring on accent.
    const current = screen.getByText("T");
    expect(current).toHaveClass("bg-accent", "text-accent-fg", "font-semibold");
    expect(current).not.toHaveAttribute("tabindex");
    expect(current.className).not.toMatch(/hover:|outline/);
  });

  it("has targets of at least 24 px", async () => {
    await renderBar("T");
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("min-h-9", "min-w-9");
    }
  });

  it("is walked with Tab, link by link, skipping the inert cells", async () => {
    const user = userEvent.setup();
    await renderBar(undefined);
    await user.tab();
    expect(screen.getByRole("link", { name: "0–9 and others" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "A" })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("link", { name: "T" })).toHaveFocus();
  });

  it("follows a letter", async () => {
    const user = userEvent.setup();
    const router = await renderBar(undefined);
    await user.click(screen.getByRole("link", { name: "W" }));
    expect(router.state.location.search).toBe("?letter=W");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderBar("A"));
  });
});
