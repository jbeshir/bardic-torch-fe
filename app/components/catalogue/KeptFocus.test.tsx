import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Disclosure } from "./Disclosure";
import { KeptFocus } from "./KeptFocus";

// The wrapper that keeps a filter form's focused control focused across
// the remount a change of URL causes: a box, a select and a button, inside
// a disclosure that comes back closed, and forgetting it once focus moves
// elsewhere.

/** A keyed form like the filter pages', navigating on every change. */
function Page() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const focusRef = useRef<string | null>(null);
  const ticked = new URLSearchParams(search).getAll("kind");
  return (
    <>
      <Link to="?letter=B">B</Link>
      <KeptFocus key={search} focusRef={focusRef}>
        <Disclosure summary="Filters">
          <form
            aria-label="Filters"
            onChange={event => {
              const data = new FormData(event.currentTarget);
              const params = new URLSearchParams();
              for (const kind of data.getAll("kind")) {
                params.append("kind", String(kind));
              }
              const sort = data.get("sort");
              if (sort) params.set("sort", String(sort));
              void navigate(`?${params}`);
            }}
            onSubmit={event => {
              event.preventDefault();
              void navigate(`?applied=${search.length}`);
            }}
          >
            {["group", "individual"].map(kind => (
              <label key={kind}>
                <input
                  type="checkbox"
                  name="kind"
                  value={kind}
                  defaultChecked={ticked.includes(kind)}
                />
                {kind}
              </label>
            ))}
            <label>
              Sort
              <select name="sort" defaultValue="">
                <option value="">Best match</option>
                <option value="title">Title</option>
              </select>
            </label>
            <button type="submit">Apply filters</button>
          </form>
        </Disclosure>
      </KeptFocus>
    </>
  );
}

async function renderPage() {
  const router = await renderWithRouter(<Page />, "/bards");
  return { router, user: userEvent.setup() };
}

/** Opens the disclosure, as the reader would before using a control. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Filters"));
}

describe("KeptFocus", () => {
  it("keeps the box just ticked focused after the form is rebuilt", async () => {
    const { router, user } = await renderPage();
    await open(user);
    screen.getByRole("checkbox", { name: "group" }).focus();
    await user.keyboard(" ");
    expect(router.state.location.search).toBe("?kind=group");
    const box = screen.getByRole("checkbox", { name: "group" });
    expect(box).toBeChecked();
    expect(box).toHaveFocus();
    // The next Tab goes on from there, not from the top of the page.
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "individual" })).toHaveFocus();
  });

  it("keeps a select focused, and the Apply button, reopening the disclosure", async () => {
    const { router, user } = await renderPage();
    await open(user);
    await user.selectOptions(screen.getByRole("combobox"), "title");
    expect(router.state.location.search).toBe("?sort=title");
    expect(screen.getByRole("combobox")).toHaveFocus();
    // The rebuilt disclosure starts closed; the button is inside it.
    screen.getByRole("button", { name: "Apply filters" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toMatch(/^\?applied=/);
    const apply = screen.getByRole("button", { name: "Apply filters" });
    expect(apply).toHaveFocus();
    expect(apply.closest("details")).toHaveAttribute("open");
  });

  it("forgets the control once focus moves elsewhere, so a later change leaves focus alone", async () => {
    const { router, user } = await renderPage();
    await open(user);
    screen.getByRole("checkbox", { name: "group" }).focus();
    const letter = screen.getByRole("link", { name: "B" });
    await user.click(letter);
    expect(router.state.location.search).toBe("?letter=B");
    expect(screen.getByRole("checkbox", { name: "group" })).not.toHaveFocus();
    expect(letter).toHaveFocus();
  });

  it("leaves focus where it is when it wasn't lost", async () => {
    const { router, user } = await renderPage();
    await open(user);
    screen.getByRole("checkbox", { name: "group" }).focus();
    const letter = screen.getByRole("link", { name: "B" });
    // Focus elsewhere with no relatedTarget (a script) keeps the memory,
    // but focus that wasn't lost by the remount is never taken.
    act(() => {
      letter.focus();
    });
    await act(() => router.navigate("?kind=individual"));
    expect(letter).toHaveFocus();
  });

  it("adds no box of its own", async () => {
    await renderPage();
    const wrapper = document.querySelector(".contents");
    expect(wrapper).toContainElement(
      screen.getByRole("form", { name: "Filters" })
    );
    expect(wrapper?.className).toBe("contents");
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderPage());
  });
});
