import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Account } from "~/constants/account";
import { renderWithRouter } from "~/test/router";
import { AccountMenu } from "./AccountMenu";

const SIGNED_IN: Account = {
  state: "signed-in",
  user: {
    id: "fixture|contributor",
    display_name: "Morwen of the Marches",
    role: "contributor",
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
