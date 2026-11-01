import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Account } from "~/constants/account";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { AccountMenu } from "./AccountMenu";

const SIGNED_IN: Account = {
  state: "signed-in",
  user: {
    id: "fixture|contributor",
    display_name: "Morwen of the Marches",
    role: "contributor",
  },
};
const MODERATOR: Account = {
  state: "signed-in",
  user: {
    id: "fixture|moderator",
    display_name: "Master Tobias Fiddler",
    role: "moderator",
  },
};
const BLOCKED: Account = {
  state: "blocked",
  message: "Your account is blocked, so you can’t make changes.",
};

function renderMenu(
  account: Account,
  placement: "header" | "bar" = "header",
  url = "/help/licence?from=menu"
) {
  return renderWithRouter(
    <>
      <AccountMenu account={account} placement={placement} />
      <button type="button">Elsewhere</button>
    </>,
    url
  );
}

function details() {
  return document.querySelector("details") as HTMLDetailsElement;
}

/** Opens the panel the way a click on the summary does in a browser. */
function openPanel() {
  act(() => {
    details().open = true;
    fireEvent(details(), new Event("toggle"));
  });
}

describe("AccountMenu signed out", () => {
  it("is a Log in link from the header that comes back to this page", async () => {
    await renderMenu({ state: "signed-out" });
    const login = screen.getByRole("link", { name: "Log in" });
    expect(login).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fhelp%2Flicence%3Ffrom%3Dmenu"
    );
    expect(document.querySelector("details")).toBeNull();
  });

  it("is a Log in cell in the bottom bar, its caption the name", async () => {
    await renderMenu({ state: "signed-out" }, "bar", "/");
    const login = screen.getByRole("link", { name: "Log in" });
    expect(login).toHaveAttribute("href", "/auth/login?returnTo=%2F");
    expect(login).toHaveClass("min-h-11", "flex-col");
  });
});

describe("AccountMenu signed in", () => {
  it("is a disclosure named for the account, its panel the name, role, Settings and Log out", async () => {
    await renderMenu(SIGNED_IN);
    const summary = screen.getByText("Account: Morwen of the Marches")
      .parentElement as HTMLElement;
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary).toHaveTextContent("MM");
    const panel = document.getElementById(
      summary.getAttribute("aria-controls") ?? ""
    ) as HTMLElement;
    expect(
      within(panel).getByText("Morwen of the Marches")
    ).toBeInTheDocument();
    expect(within(panel).getByText("Contributor")).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "Settings" })
    ).toHaveAttribute("href", "/settings");
    const logout = within(panel).getByRole("button", { name: "Log out" });
    expect(logout).toHaveAttribute("type", "submit");
    const form = logout.closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/logout");
  });

  it("names moderators as such, with their initials", async () => {
    await renderMenu(MODERATOR, "bar");
    expect(screen.getByText("Moderator")).toBeInTheDocument();
    const summary = document.querySelector("summary") as HTMLElement;
    expect(summary).toHaveTextContent("MT");
    expect(summary).toHaveTextContent("Account: Master Tobias Fiddler");
  });

  it("closes on Escape and gives focus back to its trigger", async () => {
    await renderMenu(SIGNED_IN);
    openPanel();
    screen.getByRole("link", { name: "Settings" }).focus();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(details().open).toBe(false);
    expect(document.querySelector("summary")).toHaveFocus();
  });

  it("closes when focus or a press goes outside it, leaving focus there", async () => {
    const user = userEvent.setup();
    await renderMenu(SIGNED_IN);
    openPanel();
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(details().open).toBe(false);
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();

    openPanel();
    act(() => screen.getByRole("link", { name: "Settings" }).focus());
    expect(details().open).toBe(true);
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    expect(details().open).toBe(false);
  });

  it("closes when a link in it navigates", async () => {
    const user = userEvent.setup();
    const router = await renderMenu(SIGNED_IN);
    openPanel();
    await user.click(screen.getByRole("link", { name: "Settings" }));
    expect(router.state.location.pathname).toBe("/settings");
    expect(details().open).toBe(false);
  });

  it("opens from the bottom bar upwards", async () => {
    await renderMenu(SIGNED_IN, "bar");
    const panel = document.getElementById(
      document.querySelector("summary")?.getAttribute("aria-controls") ?? ""
    );
    expect(panel).toHaveClass("bottom-full");
    expect(document.querySelector("summary")).toHaveClass("min-h-11");
  });
});

describe("AccountMenu when the profile didn't load", () => {
  it("reads Account and says so in the panel, with Try again, Settings and Log out", async () => {
    await renderMenu({ state: "profile-unavailable" });
    const summary = document.querySelector("summary") as HTMLElement;
    expect(summary).toHaveTextContent(/^Account$/);
    expect(
      screen.getByText("We couldn’t load your profile.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe("AccountMenu trigger glyphs", () => {
  it.each([
    [{ state: "profile-unavailable" } as const, "tabler-icon-user-question"],
    [BLOCKED, "tabler-icon-user-off"],
  ])(
    "tells %o apart by its glyph, on a disc with a visible edge",
    async (account, glyph) => {
      await renderMenu(account);
      const disc = document.querySelector("summary [data-state]");
      expect(disc).toHaveAttribute("data-state", account.state);
      expect(disc).toHaveClass("border", "border-border-strong");
      expect(disc?.querySelector("svg")).toHaveClass(glyph);
    }
  );
});

describe("AccountMenu for a blocked account", () => {
  it("says the account is blocked and offers Log out, not Settings", async () => {
    await renderMenu(BLOCKED);
    expect(
      screen.getByText("Your account is blocked, so you can’t make changes.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe.each(["header", "bar"] as const)("AccountMenu (%s)", placement => {
  it.each([
    ["signed out", { state: "signed-out" } as Account],
    ["signed in", SIGNED_IN],
    ["profile unavailable", { state: "profile-unavailable" } as Account],
    ["blocked", BLOCKED],
  ])("looks the same in both themes, %s", async (_, account) => {
    await expectSameMarkupInBothThemes(() => renderMenu(account, placement));
  });
});
