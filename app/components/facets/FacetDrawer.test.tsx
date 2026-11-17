import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { FacetDrawer } from "./FacetDrawer";

function Filters({
  onSubmit = () => undefined,
}: {
  readonly onSubmit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Filters
      </button>
      <FacetDrawer
        id="facet-drawer"
        open={open}
        onClose={() => setOpen(false)}
        form="facets"
        clearHref="/pieces?q=kettle"
      >
        <form
          id="facets"
          onSubmit={event => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <fieldset>
            <legend>Kind</legend>
            <label>
              <input type="checkbox" name="kind" value="song" /> Song
            </label>
          </fieldset>
        </form>
      </FacetDrawer>
    </>
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Filter pieces" });

describe("FacetDrawer", () => {
  it("opens as a modal named Filter pieces, focus on its close button", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<Filters />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(dialog()).toHaveAttribute("id", "facet-drawer");
    expect(
      within(dialog()).getAllByRole("button", { name: "Close filters" })[0]
    ).toHaveFocus();
    expect(
      within(dialog()).getByRole("checkbox", { name: "Song" })
    ).toBeVisible();
  });

  it("keeps Tab inside, and Escape returns focus to Filters", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<Filters />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const [topClose, bottomClose] = within(dialog()).getAllByRole("button", {
      name: "Close filters",
    });
    await user.tab();
    expect(within(dialog()).getByRole("checkbox")).toHaveFocus();
    await user.tab();
    expect(
      within(dialog()).getByRole("button", { name: "Show results" })
    ).toHaveFocus();
    await user.tab();
    expect(
      within(dialog()).getByRole("link", { name: "Clear all" })
    ).toHaveFocus();
    await user.tab();
    expect(bottomClose).toHaveFocus();
    await user.tab();
    expect(topClose).toHaveFocus();
    act(() => {
      fireEvent(
        document.querySelector("dialog") as HTMLDialogElement,
        new Event("cancel", { cancelable: true })
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("closes once the viewport reaches xl", async () => {
    let grow: () => void = () => undefined;
    vi.stubGlobal("matchMedia", (query: string) => {
      const list = {
        matches: false,
        addEventListener: (_: string, listener: () => void) => {
          if (query === "(min-width: 1280px)") {
            grow = () => {
              list.matches = true;
              listener();
            };
          }
        },
        removeEventListener: () => undefined,
      };
      return list;
    });
    const user = userEvent.setup();
    await renderWithRouter(<Filters />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(dialog()).toBeVisible();
    act(() => grow());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
