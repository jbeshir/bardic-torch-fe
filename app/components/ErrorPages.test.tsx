import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UNSAFE_ErrorResponseImpl } from "react-router";
import { describe, expect, it } from "vitest";
import { wikiSearchUrl } from "~/constants/navigation";
import { renderOnServer, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import {
  isResting,
  NotFound,
  RESTING_META,
  Resting,
  ServerError,
} from "./ErrorPages";

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

describe("Resting", () => {
  it("says the site is resting, with Try again first and the way home", async () => {
    await renderWithRouter(<Resting />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Bardic Torch is resting" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We’re doing some upkeep or the catalogue is briefly unreachable. Please try again in a few minutes."
      )
    ).toBeInTheDocument();
    const tryAgain = screen.getByRole("button", { name: "Try again" });
    expect(tryAgain).toHaveClass("bg-accent");
    const home = screen.getByRole("link", { name: "Go to the home page" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).not.toHaveClass("bg-accent");
    expect(tryAgain.compareDocumentPosition(home)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // No reference: an outage isn't a bug report.
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it("shows the unlit torch, not the broken one", async () => {
    await renderWithRouter(<Resting />);
    const art = document.querySelector("svg");
    expect(art?.querySelector("[stroke-dasharray]")).toBeNull();
  });

  it("is a reload link to try again without JS", async () => {
    const html = await renderOnServer(<Resting />, "/pieces?q=reeve");
    expect(html).toMatch(/<a[^>]*href="\/pieces\?q=reeve"[^>]*>.*Try again/);
    expect(html).not.toContain("<button");
  });

  it("moves between its actions from the keyboard", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<Resting />);
    await act(() => user.tab());
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await act(() => user.tab());
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveFocus();
  });

  it("is titled for the outage and kept out of search results", () => {
    expect(RESTING_META).toEqual([
      { title: "Bardic Torch is resting · Bardic Torch" },
      { name: "robots", content: "noindex" },
    ]);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<Resting />));
  });
});

describe("isResting", () => {
  /** What a loader's `throw data(body, {status})` reaches a boundary as. */
  const thrown = (body: unknown, status: number) =>
    new UNSAFE_ErrorResponseImpl(status, "", body);

  it("is true only for an error response whose body is the resting kind", () => {
    expect(isResting(thrown({ kind: "resting" }, 503))).toBe(true);
    expect(isResting(thrown({ kind: "server" }, 500))).toBe(false);
    expect(isResting(thrown(null, 503))).toBe(false);
    expect(isResting(thrown("resting", 503))).toBe(false);
    expect(isResting(new Error("resting"))).toBe(false);
    expect(isResting({ kind: "resting" })).toBe(false);
  });
});
