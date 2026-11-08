import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { UserLink } from "./UserLink";

describe("UserLink", () => {
  it("links a web address as a reader's link", async () => {
    await renderWithRouter(
      <UserLink url="https://video.example/watch">The recording</UserLink>
    );
    const link = screen.getByRole("link", { name: /The recording/ });
    expect(link).toHaveAttribute("href", "https://video.example/watch");
    expect(link).toHaveAttribute("rel", "nofollow ugc noopener");
  });

  it("never links another scheme", async () => {
    await renderWithRouter(
      <UserLink url="ftp://files.example/songbook">Not a link</UserLink>
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Not a link")).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<UserLink url="https://a.example">A</UserLink>)
    );
  });
});
