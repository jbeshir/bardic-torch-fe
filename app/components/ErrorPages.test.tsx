import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { wikiSearchUrl } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { NotFound, ServerError } from "./ErrorPages";

describe("NotFound", () => {
  it("says the page wasn't found and offers home and the original wiki", async () => {
    await renderWithRouter(<NotFound pathname="/wiki/Ballad_of_Bell" />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that page",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pages from the old wiki don’t redirect here yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", {
        name: "Look on the original wiki (opens original wiki)",
      })
    ).toHaveAttribute("href", wikiSearchUrl("Ballad of Bell"));
  });

  it("searches for the last part of any address, decoded", async () => {
    await renderWithRouter(<NotFound pathname="/a/b/the%20reeve%27s-tale/" />);
    expect(
      screen.getByRole("link", { name: /Look on the original wiki/ })
    ).toHaveAttribute("href", wikiSearchUrl("the reeve's tale"));
  });

  it("copes with an address that isn't valid percent-encoding", async () => {
    await renderWithRouter(<NotFound pathname="/%E0%A4%A" />);
    expect(
      screen.getByRole("link", { name: /Look on the original wiki/ })
    ).toHaveAttribute("href", wikiSearchUrl("%E0%A4%A"));
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<NotFound pathname="/missing" />)
    );
  });
});

describe("ServerError", () => {
  it("apologises and offers Try again and home", async () => {
    await renderWithRouter(<ServerError reference={undefined} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("That’s on us, not you. Try again in a moment.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it("asks for the Sentry reference when there is one", async () => {
    await renderWithRouter(<ServerError reference="4f2a9c1e7d3b" />);
    expect(screen.getByText(/include the reference below/)).toBeInTheDocument();
    expect(screen.getByText("Reference: 4f2a9c1e7d3b")).toBeInTheDocument();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ServerError reference="abc" />)
    );
  });
});
