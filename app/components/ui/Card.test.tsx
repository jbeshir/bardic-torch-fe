import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Card, CardList } from "./Card";

/** The card box: the title heading's parent. */
function card(name: string) {
  return screen.getByRole("heading", { name }).parentElement as HTMLElement;
}

describe("Card", () => {
  it("is a static box with a plain h3 title: no link, no hover", () => {
    render(
      <Card title="Links only" eyebrow="Why" meta="Updated 3 Oct 2026">
        We never host lyrics, recordings or video.
      </Card>
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Links only" })
    ).toBeInTheDocument();
    const box = card("Links only");
    expect(within(box).queryByRole("link")).toBeNull();
    expect(box).not.toHaveClass("hover:border-border-strong");
    expect(box).toHaveClass(
      "bg-surface",
      "border-border",
      "rounded-lg",
      "shadow-1"
    );
    expect(screen.getByText("Why")).toHaveClass("text-label-caps", "uppercase");
    expect(screen.getByText("Updated 3 Oct 2026")).toHaveClass(
      "text-fg-subtle"
    );
  });

  it("keeps its whole body: nothing is clamped away", () => {
    render(<Card title="Links only">One. Two. Three. Four.</Card>);
    const body = screen.getByText("One. Two. Three. Four.");
    expect(body.className).not.toMatch(/line-clamp/);
  });

  it("makes the title the link in the link variant, stretched over the card", async () => {
    const router = await renderWithRouter(
      <Card title="Contributing" to="/help/contributing">
        How to add a piece.
      </Card>
    );
    const link = screen.getByRole("link", { name: "Contributing" });
    expect(link.closest("h3")).not.toBeNull();
    expect(link).toHaveClass("after:absolute", "after:inset-0");
    expect(card("Contributing")).toHaveClass(
      "relative",
      "hover:border-border-strong"
    );
    await act(() => userEvent.click(link));
    expect(router.state.location.pathname).toBe("/help/contributing");
  });

  it("draws the link variant's focus ring around the whole card", async () => {
    const user = userEvent.setup();
    await renderWithRouter(
      <Card title="Contributing" to="/help/contributing">
        How to add a piece.
      </Card>
    );
    await act(() => user.tab());
    const link = screen.getByRole("link");
    expect(link).toHaveFocus();
    expect(link).toHaveClass(
      "focus-visible:outline-none",
      "focus-visible:after:outline",
      "focus-visible:after:outline-focus",
      "focus-visible:after:outline-offset-2"
    );
  });

  it("can use an h2 title", () => {
    render(
      <Card title="Help" headingLevel={2}>
        Body
      </Card>
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Help");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <Card title="Contributing" to="/help/contributing">
          Body
        </Card>
      )
    );
  });
});

describe("CardList", () => {
  it("puts each card in an item of an explicit list", () => {
    render(
      <CardList>
        <Card title="One">A</Card>
        <Card title="Two">B</Card>
      </CardList>
    );
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("role", "list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[0] as HTMLElement).getByRole("heading", { name: "One" })
    ).toBeVisible();
  });

  it("opts out of the prose styles, so help prose can't restyle its cards", () => {
    render(
      <div className="prose-bt">
        <CardList>
          <Card title="One">A</Card>
        </CardList>
      </div>
    );
    expect(screen.getByRole("list")).toHaveClass("not-prose");
  });

  it("goes to three columns from lg, or stops at two within a measure", () => {
    const { rerender } = render(
      <CardList>
        <Card title="One">A</Card>
      </CardList>
    );
    expect(screen.getByRole("list")).toHaveClass(
      "md:grid-cols-2",
      "lg:grid-cols-3"
    );
    rerender(
      <CardList columns={2}>
        <Card title="One">A</Card>
      </CardList>
    );
    expect(screen.getByRole("list")).toHaveClass("md:grid-cols-2");
    expect(screen.getByRole("list")).not.toHaveClass("lg:grid-cols-3");
  });

  it("lets an odd last card span the two columns, so no half row is left empty", () => {
    render(
      <CardList>
        <Card title="One">A</Card>
        <Card title="Two">B</Card>
        <Card title="Three">C</Card>
      </CardList>
    );
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass(
        "md:last:odd:col-span-2",
        "lg:last:odd:col-span-1"
      );
    }
  });
});
