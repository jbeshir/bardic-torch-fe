import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { TokenReveal } from "./TokenReveal";

const SECRET = `user_api|${"ab".repeat(32)}`;

describe("TokenReveal", () => {
  it("says it is shown once, and puts focus on the selected value", () => {
    render(<TokenReveal secret={SECRET} onDismiss={() => undefined} />);
    expect(
      screen.getByText("Token created. Copy it now — you won’t see it again.")
    ).toBeInTheDocument();
    const value = screen.getByRole("textbox", { name: "New token value" });
    expect(value).toHaveValue(SECRET);
    expect(value).toHaveAttribute("readonly");
    expect(value).toHaveClass("font-mono", "wrap-anywhere", "select-all");
    // Never cut off: it grows to the secret, or has rows for all of it at
    // 320 px where field-sizing isn't supported.
    expect(value).toHaveClass("field-sizing-content");
    expect(value).toHaveAttribute("rows", "4");
    expect(value).toHaveFocus();
    const box = value as HTMLTextAreaElement;
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, SECRET.length]);
  });

  it("copies with the clipboard and says so, then reads Copied", async () => {
    const user = userEvent.setup();
    render(<TokenReveal secret={SECRET} onDismiss={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(SECRET);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Token copied");
    expect(screen.getByRole("status")).toHaveClass("sr-only");
  });

  it("shows, not just announces, that the browser refused to copy", async () => {
    const user = userEvent.setup();
    render(<TokenReveal secret={SECRET} onDismiss={() => undefined} />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied")
    );
    await user.click(screen.getByRole("button", { name: "Copy" }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Your browser didn’t let us copy it. The token is selected: copy it with your keyboard or menu."
    );
    expect(status).not.toHaveClass("sr-only");
    expect(
      screen.getByRole("textbox", { name: "New token value" })
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("is dismissed by I've copied it, from the keyboard too", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<TokenReveal secret={SECRET} onDismiss={onDismiss} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Copy" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "I’ve copied it" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<TokenReveal secret={SECRET} onDismiss={() => undefined} />)
    );
  });
});
