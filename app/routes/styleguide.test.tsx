import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import { COLOURS, resolveColour } from "~/styles/tokens";
import { contrastLabel } from "~/styleguide/contrast";
import { SPECIMENS } from "~/styleguide/Gallery";
import { renderWithRouter } from "~/test/router";
import Styleguide, { meta } from "./styleguide";

async function renderStyleguide() {
  await renderWithRouter(
    <ToastProvider>
      <Styleguide />
    </ToastProvider>,
    "/styleguide"
  );
}

function currentPanel() {
  return screen.getByRole("tabpanel", { name: "Current" });
}

describe("/styleguide", () => {
  it("is titled, kept out of search engines and headed 'Styleguide'", async () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Styleguide · Bardic Torch" },
      { name: "robots", content: "noindex, nofollow" },
    ]);
    await renderStyleguide();
    expect(
      screen.getByRole("heading", { level: 1, name: "Styleguide" })
    ).toBeInTheDocument();
  });

  it("anchors every block in the current preview and lists it in the contents", async () => {
    await renderStyleguide();
    const contents = screen.getByRole("navigation", {
      name: "Styleguide contents",
    });
    for (const { id, title } of SPECIMENS) {
      const block = currentPanel().querySelector(`section#${id}`);
      expect(block, id).not.toBeNull();
      expect(block).toHaveAccessibleName(title);
      expect(
        within(contents).getByRole("link", { name: title })
      ).toHaveAttribute("href", `#${id}`);
    }
  });

  it("renders one gallery at a time and never repeats an id", async () => {
    const user = userEvent.setup();
    await renderStyleguide();
    const expected = {
      Current: SPECIMENS.length,
      Light: SPECIMENS.length,
      Dark: SPECIMENS.length,
      "Side by side": SPECIMENS.length * 2,
    };
    for (const [name, blocks] of Object.entries(expected)) {
      await act(() => user.click(screen.getByRole("tab", { name })));
      expect(
        document.querySelectorAll("section[data-specimen]"),
        name
      ).toHaveLength(blocks);
      const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
      expect(new Set(ids).size, name).toBe(ids.length);
    }
  });

  it("previews Current, Light, Dark and Side by side from a tablist", async () => {
    const user = userEvent.setup();
    await renderStyleguide();
    const tablist = screen.getByRole("tablist", { name: "Preview" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map(tab => tab.textContent)).toEqual([
      "Current",
      "Light",
      "Dark",
      "Side by side",
    ]);
    expect(currentPanel().querySelector("[data-theme]")).toBeNull();

    await act(() => user.click(tabs[1] as HTMLElement));
    const light = screen.getByRole("tabpanel", { name: "Light" });
    expect(light.querySelector('[data-theme="light"]')).toHaveClass(
      "bg-canvas"
    );
    expect(light.querySelector("section#light-button")).not.toBeNull();

    await act(() => user.keyboard("{ArrowRight}"));
    const dark = screen.getByRole("tabpanel", { name: "Dark" });
    expect(dark.querySelector('[data-theme="dark"]')).not.toBeNull();

    await act(() => user.keyboard("{End}"));
    const both = screen.getByRole("tabpanel", { name: "Side by side" });
    expect(
      [...both.querySelectorAll("[data-theme]")].map(panel =>
        panel.getAttribute("data-theme")
      )
    ).toEqual(["light", "dark"]);
    expect(both.firstElementChild).toHaveClass("xl:grid-cols-2");
  });

  it("shows a swatch for every colour token with both values and its contrast", async () => {
    await renderStyleguide();
    const colour = within(
      currentPanel().querySelector("#colour") as HTMLElement
    );
    const swatches = colour.getAllByRole("listitem");
    expect(swatches).toHaveLength(Object.keys(COLOURS.light).length);
    const canvas = swatches[0] as HTMLElement;
    expect(canvas).toHaveTextContent("canvas");
    expect(canvas).toHaveTextContent(
      `Light ${resolveColour("light", "canvas")} · 1.00:1`
    );
    expect(canvas).toHaveTextContent(
      `Dark ${resolveColour("dark", "canvas")} · 1.00:1`
    );
    expect(canvas.querySelector("[aria-hidden]")).toHaveClass("bg-canvas");
  });

  it("shows every state the DESIGN lists for the components", async () => {
    await renderStyleguide();
    const panel = within(currentPanel());
    expect(panel.getAllByRole("button", { name: "Save changes" })).toHaveLength(
      3
    );
    expect(
      panel
        .getAllByRole("button", { name: "Save changes" })
        .map(button =>
          button.hasAttribute("disabled")
            ? "disabled"
            : button.getAttribute("aria-busy") === "true"
              ? "loading"
              : "rest"
        )
    ).toEqual(["rest", "disabled", "loading"]);
    expect(
      panel.getAllByRole("checkbox", { checked: true }).length
    ).toBeGreaterThan(0);
    expect(
      panel
        .getAllByRole("checkbox")
        .filter(box => (box as HTMLInputElement).indeterminate)
    ).toHaveLength(1);
    expect(
      panel.getAllByRole("textbox", { name: /Display name/ })[1]
    ).toHaveAttribute("aria-invalid", "true");
    expect(panel.getByRole("navigation", { name: "Page views" })).toBeVisible();
    expect(
      panel.getAllByRole("navigation", { name: "Pagination" })
    ).toHaveLength(3);
    expect(
      within(panel.getByRole("region", { name: "Infobox" })).getAllByRole(
        "complementary",
        { name: "At a glance" }
      )
    ).toHaveLength(3);
    const accounts = within(panel.getByRole("region", { name: "AccountMenu" }));
    expect(accounts.getByRole("link", { name: "Log in" })).toBeVisible();
    expect(
      accounts.getByText("Account: Morwen of the Marches")
    ).toBeInTheDocument();
    expect(
      accounts.getByText("We couldn’t load your profile.")
    ).toBeInTheDocument();
    expect(accounts.getByText(/Your account is blocked/)).toBeInTheDocument();
    const page = within(panel.getByRole("region", { name: "Wiki page" }));
    expect(
      page.getByRole("navigation", { name: "Contents" })
    ).toBeInTheDocument();
    expect(
      page.getByRole("navigation", { name: "Categories" })
    ).toBeInTheDocument();
    expect(panel.getByText("Reference: 7f3a2c9e41d04b8a")).toBeVisible();
  });
});

describe("contrastLabel", () => {
  it("matches the DESIGN §2.7 table", () => {
    expect(contrastLabel("light", "fg", "canvas")).toBe("14.11:1");
    expect(contrastLabel("dark", "fg", "canvas")).toBe("13.34:1");
    expect(contrastLabel("light", "canvas", "fg")).toBe("14.11:1");
    expect(contrastLabel("light", "input-bg", "canvas")).toBe(
      contrastLabel("light", "surface-raised", "canvas")
    );
  });
});
