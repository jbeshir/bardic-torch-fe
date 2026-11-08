import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { useResultsFocus } from "./useResultsFocus";

// Where focus goes after a list changes in place: to the results heading
// when the link used went away with the old list, and nowhere otherwise.

/** A list whose current letter is text, not a link, as LetterBar does. */
function List() {
  const { search } = useLocation();
  const letter = new URLSearchParams(search).get("letter") ?? "A";
  const headingRef = useResultsFocus(search);
  return (
    <>
      <nav aria-label="Letters">
        {["A", "B"].map(each =>
          each === letter ? (
            <span key={each} aria-current="page">
              {each}
            </span>
          ) : (
            <Link key={each} to={`?letter=${each}`}>
              {each}
            </Link>
          )
        )}
      </nav>
      <Link to={`?letter=${letter}&page=2`}>Next</Link>
      <h2 ref={headingRef} tabIndex={-1}>
        Under {letter}
      </h2>
    </>
  );
}

describe("useResultsFocus", () => {
  it("leaves the first render alone", async () => {
    await renderWithRouter(<List />, "/pieces");
    expect(document.body).toHaveFocus();
  });

  it("moves focus to the results heading when the link used is gone", async () => {
    const router = await renderWithRouter(<List />, "/pieces");
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "B" }));
    expect(router.state.location.search).toBe("?letter=B");
    expect(screen.getByRole("heading", { name: "Under B" })).toHaveFocus();
  });

  it("leaves focus on a link the new list kept", async () => {
    const router = await renderWithRouter(<List />, "/pieces");
    const user = userEvent.setup();
    const next = screen.getByRole("link", { name: "Next" });
    await user.click(next);
    expect(router.state.location.search).toBe("?letter=A&page=2");
    expect(next).toHaveFocus();
  });

  it("doesn't move focus for a render with the same list", async () => {
    const router = await renderWithRouter(<List />, "/pieces?letter=B");
    await act(() => router.navigate("/pieces?letter=B"));
    expect(document.body).toHaveFocus();
  });
});
