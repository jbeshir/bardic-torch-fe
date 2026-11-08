import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { PageBanner } from "./PageBanner";

const STATEMENT = "https://example.org/wren/statement";

/** The banner box: the Alert's outer element. */
function box(text: string) {
  return screen.getByText(text).closest("div.flex");
}

describe("PageBanner", () => {
  it.each(["piece", "person"] as const)(
    "says a %s page is a stub, pointing at the contributing guide",
    async subject => {
      await renderWithRouter(<PageBanner kind="stub" subject={subject} />);
      expect(screen.getByText("This page is a stub.")).toBeInTheDocument();
      expect(
        screen.getByText(
          `We know this ${subject} exists but haven’t gathered much yet.`
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "How to contribute" })
      ).toHaveAttribute("href", "/help/contributing");
      // An info banner: full-bleed below md, with its hidden tone name.
      expect(box("This page is a stub.")).toHaveClass(
        "bg-info-bg",
        "rounded-none",
        "md:rounded-lg"
      );
      expect(screen.getByText(/^Information:/)).toHaveClass("sr-only");
    }
  );

  it("asks readers to respect a restricted work, with a lock and the statement", async () => {
    await renderWithRouter(
      <PageBanner kind="restricted" statementUrl={STATEMENT} />
    );
    const title =
      "The creator has asked that this work isn’t recorded or shared.";
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("Please respect their wishes.")).toBeVisible();
    expect(box(title)?.querySelector("svg.tabler-icon-lock")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    const statement = screen.getByRole("link", {
      name: "Read their statement (external link)",
    });
    expect(statement).toHaveAttribute("href", STATEMENT);
    expect(statement).toHaveAttribute("rel", "nofollow ugc noopener");
    // No preservation prompt and no contributing link (R-7).
    expect(screen.queryByRole("link", { name: /contribute/i })).toBeNull();
  });

  it("has no action when there's no statement on record", async () => {
    await renderWithRouter(<PageBanner kind="restricted" />);
    expect(screen.queryByRole("link")).toBeNull();
    const body = screen.getByText("Please respect their wishes.");
    // No empty actions row under the body.
    expect(body.nextElementSibling).toBeNull();
  });

  it("records a person's wish not to have a page", async () => {
    await renderWithRouter(
      <PageBanner
        kind="no-page"
        name="Wren of the Vale"
        statementUrl={STATEMENT}
      />
    );
    expect(
      screen.getByText("Wren of the Vale has asked not to have a page here.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This stub keeps their request on record so the page isn’t recreated."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Read their statement (external link)" })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
  });

  it("no-page without a statement has no link", async () => {
    await renderWithRouter(<PageBanner kind="no-page" name="Hollis Fenn" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reaches its action from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <PageBanner kind="stub" subject="piece" />
    );
    await act(() => user.tab());
    expect(
      screen.getByRole("link", { name: "How to contribute" })
    ).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help/contributing");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <>
          <PageBanner kind="stub" subject="piece" />
          <PageBanner kind="restricted" statementUrl={STATEMENT} />
          <PageBanner kind="no-page" name="Hollis Fenn" />
        </>
      )
    );
  });
});
