import { IconDeviceFloppy, IconMenu2, IconTrash } from "@tabler/icons-react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Button, ButtonLink } from "./Button";

describe("Button", () => {
  it("is a real button, type button unless asked to submit", () => {
    render(<Button>Cancel</Button>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it.each([
    ["primary", ["bg-accent", "text-accent-fg", "hover:bg-accent-hover"]],
    ["secondary", ["bg-surface-raised", "text-fg", "border-border-strong"]],
    ["ghost", ["bg-transparent", "text-fg-muted", "hover:bg-surface-sunken"]],
    ["danger", ["bg-danger", "text-danger-on", "hover:bg-danger-hover"]],
    [
      "secondary-danger",
      ["bg-surface-raised", "text-danger-fg", "border-danger-icon"],
    ],
  ] as const)("styles the %s variant from tokens", (variant, classes) => {
    render(
      variant === "danger" || variant === "secondary-danger" ? (
        <Button variant={variant} icon={IconTrash}>
          Revoke token
        </Button>
      ) : (
        <Button variant={variant}>Save changes</Button>
      )
    );
    expect(screen.getByRole("button")).toHaveClass(...classes);
  });

  it("gives every variant a border, so forced colours still draw its edge", () => {
    render(
      <>
        <Button variant="primary">One</Button>
        <Button variant="ghost">Two</Button>
        <Button variant="danger" icon={IconTrash}>
          Delete
        </Button>
      </>
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("border", "border-transparent");
    }
  });

  it("always shows the danger icon next to the verb", () => {
    render(
      <Button variant="danger" icon={IconTrash}>
        Revoke token
      </Button>
    );
    const button = screen.getByRole("button", { name: "Revoke token" });
    const icon = button.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveTextContent("Revoke token");
  });

  it.each([
    ["sm", "min-h-9", "text-body-sm"],
    ["md", "min-h-11", "text-body"],
    ["lg", "min-h-13", "font-semibold"],
  ] as const)("is %s: %s tall", (size, height, text) => {
    render(<Button size={size}>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass(height, text);
  });

  it("pads small buttons' hit area to 44 px below lg", () => {
    render(<Button size="sm">Log in</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "before:absolute",
      "before:-inset-1",
      "lg:before:hidden"
    );
  });

  it("names an icon-only button with its label, square at its size", () => {
    render(<Button variant="ghost" icon={IconMenu2} label="Menu" />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveTextContent("");
    expect(button).toHaveClass("w-11", "min-h-11");
  });

  it("stretches to full width when asked", () => {
    render(<Button fullWidth>Close menu</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("is natively disabled, with the disabled tokens", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Save changes
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      "disabled:bg-surface-sunken",
      "disabled:text-fg-subtle",
      "disabled:border-border"
    );
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("while loading: keeps its label, shows the spinner in the icon's place, stays focusable and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={event => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button
          type="submit"
          variant="primary"
          icon={IconDeviceFloppy}
          loading
          onClick={onClick}
        >
          Save changes
        </Button>
      </form>
    );
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    const [icon, spinner] = [...button.querySelectorAll("svg")];
    expect(icon).toHaveClass("invisible");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    // Icon and spinner share one grid cell, so the width can't change.
    expect(icon?.parentElement).toBe(spinner?.parentElement?.parentElement);

    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the pressed state of a toggle button", () => {
    render(<Button aria-pressed>Bold</Button>);
    const button = screen.getByRole("button", { name: "Bold" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass(
      "aria-pressed:bg-accent-subtle",
      "aria-pressed:text-accent-text"
    );
  });

  it("activates with Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Copy</Button>);
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("submits its form when it is a submit button", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={event => onSubmit(event.nativeEvent)}>
        <Button type="submit" variant="primary">
          Create token
        </Button>
      </form>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("only moves on press when motion is allowed", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "motion-safe:active:translate-y-px"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <>
          <Button variant="primary">Save changes</Button>
          <Button variant="danger" icon={IconTrash}>
            Revoke token
          </Button>
          <Button variant="ghost" icon={IconMenu2} label="Menu" />
        </>
      )
    );
  });
});

describe("ButtonLink", () => {
  it("navigates inside the app like a link, styled as a button", async () => {
    const router = await renderWithRouter(
      <ButtonLink to="/help/contributing" variant="primary" size="lg">
        How to contribute
      </ButtonLink>
    );
    const link = screen.getByRole("link", { name: "How to contribute" });
    expect(link).toHaveAttribute("href", "/help/contributing");
    expect(link).toHaveClass("bg-accent", "min-h-13");
    await act(() => userEvent.click(link));
    expect(router.state.location.pathname).toBe("/help/contributing");
  });

  it("follows with Enter from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <ButtonLink to="/help">Help</ButtonLink>
    );
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help");
  });

  it("marks an external target with an icon and a hidden suffix after the label", async () => {
    await renderWithRouter(
      <ButtonLink
        to="https://bardictorch.miraheze.org/wiki/Main_Page"
        external="wiki"
        size="lg"
      >
        Browse on the original wiki
      </ButtonLink>
    );
    const link = screen.getByRole("link", {
      name: "Browse on the original wiki (opens original wiki)",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://bardictorch.miraheze.org/wiki/Main_Page"
    );
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).not.toHaveAttribute("target");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("can load the page from the server instead, without prefetching", async () => {
    const router = await renderWithRouter(
      <ButtonLink to="/help/licence?section=2" reloadDocument>
        Try again
      </ButtonLink>
    );
    const link = screen.getByRole("link", { name: "Try again" });
    expect(link).toHaveAttribute("href", "/help/licence?section=2");
    await act(() => userEvent.hover(link));
    expect(document.querySelector('link[rel="prefetch"]')).toBeNull();
    // The router handles clicks on app links (preventDefault); this one is
    // left to the browser. Listening on the document runs after React's
    // handler, and stops jsdom's unimplemented navigation.
    let handledByApp: boolean | undefined;
    const observe = (event: Event) => {
      handledByApp = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", observe);
    await act(() => userEvent.click(link));
    document.removeEventListener("click", observe);
    expect(handledByApp).toBe(false);
    expect(router.state.location.pathname).toBe("/");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ButtonLink to="/help">Help</ButtonLink>)
    );
  });
});
