import { IconDeviceFloppy, IconTrash } from "@tabler/icons-react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

function RevokeToken({
  pending = false,
  onRevoke = () => undefined,
}: {
  pending?: boolean;
  onRevoke?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Revoke
      </button>
      <button type="button">After</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Revoke this token?"
        description="Anything using ‘Laptop MCP’ will stop working straight away. This can’t be undone."
        pending={pending}
        confirm={{
          label: "Revoke token",
          icon: IconTrash,
          variant: "danger",
          onConfirm: onRevoke,
        }}
      />
    </>
  );
}

function RenameToken() {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rename
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename token"
        initialFocus={fieldRef}
        confirm={{
          label: "Save name",
          icon: IconDeviceFloppy,
          variant: "primary",
          form: "rename",
        }}
      >
        <form id="rename" onSubmit={event => event.preventDefault()}>
          <Field label="Token name">
            <Input ref={fieldRef} name="name" />
          </Field>
        </form>
      </Dialog>
    </>
  );
}

function dialog() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

function pressEscape() {
  // jsdom has no close requests: the browser turns Escape into `cancel`.
  return fireEvent(dialog(), new Event("cancel", { cancelable: true }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dialog", () => {
  it("opens as a modal, named by its h2 and described by its body", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const user = userEvent.setup();
    render(<RevokeToken />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(showModal).toHaveBeenCalledTimes(1);
    const box = screen.getByRole("dialog", { name: "Revoke this token?" });
    expect(box).toHaveAccessibleDescription(
      "Anything using ‘Laptop MCP’ will stop working straight away. This can’t be undone."
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Revoke this token?" })
    ).toHaveClass("text-h3");
  });

  it("opens and closes in the same commit as its content", () => {
    // A later sibling's layout effect runs in that commit, before any
    // passive effect: what it sees is what the first paint (and a query
    // made as soon as, say, an alert rendered with the close appears)
    // sees. A close left to a passive effect showed an open, emptied
    // dialog there.
    const seen: { open: boolean; modal: boolean; content: boolean }[] = [];
    function Probe({ open }: { open: boolean }) {
      useLayoutEffect(() => {
        seen.push({
          open,
          modal: dialog().open,
          content: dialog().querySelector("h2") !== null,
        });
      }, [open]);
      return null;
    }
    function Page({ open }: { open: boolean }) {
      return (
        <>
          <Dialog
            open={open}
            onClose={() => undefined}
            title="Revoke this token?"
            confirm={{
              label: "Revoke token",
              icon: IconTrash,
              variant: "danger",
            }}
          />
          <Probe open={open} />
        </>
      );
    }
    const { rerender } = render(<Page open={false} />);
    rerender(<Page open />);
    rerender(<Page open={false} />);
    expect(seen).toEqual([
      { open: false, modal: false, content: false },
      { open: true, modal: true, content: true },
      { open: false, modal: false, content: false },
    ]);
  });

  it("starts on Cancel, the least destructive control", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("starts on the field it is given, for forms", async () => {
    const user = userEvent.setup();
    render(<RenameToken />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Token name" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Save name" })).toHaveAttribute(
      "type",
      "submit"
    );
    expect(screen.getByRole("button", { name: "Save name" })).toHaveAttribute(
      "form",
      "rename"
    );
  });

  it("keeps Tab and Shift+Tab inside, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    const close = screen.getByRole("button", { name: "Close" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const revoke = screen.getByRole("button", { name: "Revoke token" });
    await user.tab();
    expect(revoke).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(revoke).toHaveFocus();
  });

  it.each([
    ["Escape", () => pressEscape()],
    [
      "Cancel",
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    [
      "the close button",
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
    ],
  ])(
    "closes with %s and returns focus to the opener",
    async (_how, closeIt) => {
      const user = userEvent.setup();
      render(<RevokeToken />);
      const opener = screen.getByRole("button", { name: "Revoke" });
      await user.click(opener);
      act(() => {
        closeIt();
      });
      expect(dialog().open).toBe(false);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(opener).toHaveFocus();
    }
  );

  it("stops the page scrolling while open", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(document.documentElement).toHaveClass("overflow-hidden");
    act(() => {
      pressEscape();
    });
    expect(document.documentElement).not.toHaveClass("overflow-hidden");
  });

  it("runs the confirm action", async () => {
    const onRevoke = vi.fn();
    const user = userEvent.setup();
    render(<RevokeToken onRevoke={onRevoke} />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    const revoke = screen.getByRole("button", { name: "Revoke token" });
    expect(revoke).toHaveClass("bg-danger");
    expect(revoke.querySelector("svg")).toHaveClass("tabler-icon-trash");
    await user.click(revoke);
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("doesn't close a destructive dialog from the backdrop", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(dialog().open).toBe(true);
  });

  it("closes a non-destructive dialog from the backdrop, but not from a drag out of the content", async () => {
    const user = userEvent.setup();
    render(<RenameToken />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.pointerDown(screen.getByRole("textbox"));
    fireEvent.click(dialog());
    expect(dialog().open).toBe(true);
    act(() => {
      fireEvent.pointerDown(dialog());
      fireEvent.click(dialog());
    });
    expect(dialog().open).toBe(false);
  });

  it("while pending, ignores Escape and shows the confirm button busy", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    rerender(<RevokeToken pending />);
    expect(pressEscape()).toBe(false);
    expect(dialog().open).toBe(true);
    const revoke = screen.getByRole("button", { name: "Revoke token" });
    expect(revoke).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("stays in step when the browser closes it itself", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    act(() => {
      dialog().close();
    });
    expect(
      screen.queryByRole("heading", { name: "Revoke this token?" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Revoke" })).toHaveFocus();
  });

  it("sends focus to a fallback when the opener has gone", async () => {
    function DeleteRow() {
      const [open, setOpen] = useState(false);
      const [row, setRow] = useState(true);
      const headingRef = useRef<HTMLHeadingElement>(null);
      return (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Your tokens
          </h2>
          {row ? (
            <button type="button" onClick={() => setOpen(true)}>
              Revoke
            </button>
          ) : null}
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Revoke this token?"
            fallbackFocus={() => headingRef.current}
            confirm={{
              label: "Revoke token",
              icon: IconTrash,
              variant: "danger",
              onConfirm: () => {
                setRow(false);
                setOpen(false);
              },
            }}
          />
        </>
      );
    }
    const user = userEvent.setup();
    render(<DeleteRow />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Revoke token" }));
    expect(screen.getByRole("heading", { name: "Your tokens" })).toHaveFocus();
  });

  it("stacks the buttons below sm with Cancel at the bottom, and right-aligns them from sm", async () => {
    const user = userEvent.setup();
    render(<RevokeToken />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const row = cancel.parentElement;
    expect(row).toHaveClass(
      "flex-col-reverse",
      "sm:flex-row",
      "sm:justify-end"
    );
    expect(row?.firstElementChild).toBe(cancel);
  });

  it("is sized and styled from tokens, animating only when motion is allowed", () => {
    render(<RevokeToken />);
    expect(dialog()).toHaveClass(
      "w-dialog",
      "bg-surface-raised",
      "rounded-xl",
      "shadow-3",
      "border-border",
      "backdrop:bg-scrim/scrim",
      "motion-safe:animate-dialog-in",
      "motion-reduce:animate-fade-in"
    );
  });

  it("gives each dialog its own ids", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RevokeToken />
        <RevokeToken />
      </>
    );
    const [first] = screen.getAllByRole("button", { name: "Revoke" });
    await user.click(first as HTMLElement);
    const [one, two] = [...document.querySelectorAll("dialog")];
    expect(one?.getAttribute("aria-labelledby")).not.toBe(
      two?.getAttribute("aria-labelledby")
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(async () => {
      render(<RevokeToken />);
      await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    });
  });
});
