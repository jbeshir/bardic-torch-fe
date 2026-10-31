import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { wikiPageUrl } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Link } from "./Link";

const WIKI = wikiPageUrl("Category:Moods");

describe("Link", () => {
  it("goes through the router for internal paths", async () => {
    const router = await renderWithRouter(
      <Link to="/help/licence">Licence &amp; attribution</Link>
    );
    const link = screen.getByRole("link", { name: "Licence & attribution" });
    expect(link).toHaveAttribute("href", "/help/licence");
    await act(() => userEvent.click(link));
    expect(router.state.location.pathname).toBe("/help/licence");
  });

  it("follows with Enter from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(<Link to="/help">Help</Link>);
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help");
  });

  it("marks external links with an icon and '(external link)', same tab", async () => {
    await renderWithRouter(
      <Link to="https://creativecommons.org/licenses/by-sa/4.0/">
        Creative Commons Attribution-ShareAlike 4.0
      </Link>
    );
    const link = screen.getByRole("link", {
      name: "Creative Commons Attribution-ShareAlike 4.0 (external link)",
    });
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).not.toHaveAttribute("target");
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("text-fg-subtle");
    // The icon wraps with the last word, never on a line of its own.
    expect(icon?.parentElement).toHaveClass("whitespace-nowrap");
    expect(icon?.parentElement).toHaveTextContent(/^4\.0/);
  });

  it("says old-wiki links open the original wiki", async () => {
    await renderWithRouter(
      <Link to={WIKI} external="wiki">
        Mood
      </Link>
    );
    expect(
      screen.getByRole("link", { name: "Mood (opens original wiki)" })
    ).toHaveAttribute("href", WIKI);
  });

  it("keeps the mark with non-text children too", async () => {
    await renderWithRouter(
      <Link to={WIKI} external="wiki">
        <strong>Moods</strong>
      </Link>
    );
    expect(
      screen.getByRole("link", { name: "Moods (opens original wiki)" })
    ).toBeInTheDocument();
  });

  it.each([
    ["prose", ["underline", "decoration-link/40", "visited:text-link-visited"]],
    ["standalone", ["text-link", "no-underline", "hover:underline"]],
    ["muted", ["text-fg-muted", "underline", "decoration-fg-subtle/50"]],
    ["inherit", ["text-inherit", "underline"]],
  ] as const)(
    "styles the %s appearance from tokens",
    async (appearance, classes) => {
      await renderWithRouter(
        <Link to="/help" appearance={appearance}>
          Help
        </Link>
      );
      expect(screen.getByRole("link")).toHaveClass("rounded-sm", ...classes);
    }
  );

  it("marks the current page", async () => {
    await renderWithRouter(
      <Link to="/help" current>
        Help
      </Link>
    );
    const link = screen.getByRole("link", { name: "Help" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("font-semibold", "text-fg", "no-underline");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <p>
          <Link to="/help" appearance="prose">
            Help
          </Link>{" "}
          <Link to={WIKI} external="wiki">
            Mood
          </Link>
        </p>
      )
    );
  });
});
