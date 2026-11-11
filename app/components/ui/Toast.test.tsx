import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

type Tone = "success" | "info" | "danger";

function Raise({ tone, message }: { tone: Tone; message: string }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show({ tone, message })}>
      Raise {message}
    </button>
  );
}

function Page() {
  return (
    <ToastProvider>
      <Raise tone="success" message="Display name saved." />
      <Raise tone="info" message="Token copied." />
      <Raise
        tone="danger"
        message="You seem to be offline. Your changes haven’t been saved yet."
      />
    </ToastProvider>
  );
}

function raise(message: string) {
  fireEvent.click(screen.getByRole("button", { name: `Raise ${message}` }));
}

function region() {
  return screen.getByRole("region", { name: "Notifications" });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast region", () => {
  it("puts success and info in the polite list and errors in the assertive one", () => {
    render(<Page />);
    raise("Display name saved.");
    raise("Token copied.");
    raise("You seem to be offline. Your changes haven’t been saved yet.");
    const status = within(region()).getByRole("status");
    const alert = within(region()).getByRole("alert");
    expect(status).toHaveTextContent(
      "Success: Display name saved.Information: Token copied."
    );
    expect(alert).toHaveTextContent(
      "Error: You seem to be offline. Your changes haven’t been saved yet."
    );
  });

  it("never moves focus to a toast", () => {
    render(<Page />);
    const trigger = screen.getByRole("button", {
      name: "Raise Display name saved.",
    });
    trigger.focus();
    raise("Display name saved.");
    expect(trigger).toHaveFocus();
  });

  it("dismisses success and info after 6 s, fading out", () => {
    render(<Page />);
    raise("Display name saved.");
    act(() => vi.advanceTimersByTime(5999));
    const message = screen.getByText("Display name saved.");
    expect(message.closest("div")).not.toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(1));
    expect(message.closest("div")).toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByText("Display name saved.")).toBeNull();
  });

  it("never dismisses an error on its own", () => {
    render(<Page />);
    raise("You seem to be offline. Your changes haven’t been saved yet.");
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText(/^You seem to be offline/)).toBeVisible();
  });

  it("closes with its Dismiss notification button", () => {
    render(<Page />);
    raise("You seem to be offline. Your changes haven’t been saved yet.");
    const dismiss = screen.getByRole("button", {
      name: "Dismiss notification",
    });
    expect(dismiss).toHaveClass("min-h-9", "w-9");
    fireEvent.click(dismiss);
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByText(/^You seem to be offline/)).toBeNull();
  });

  it("pauses while the pointer is over the region and resumes with the time left", () => {
    render(<Page />);
    raise("Display name saved.");
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.pointerEnter(region());
    act(() => vi.advanceTimersByTime(30_000));
    expect(
      screen.getByText("Display name saved.").closest("div")
    ).not.toHaveClass("opacity-0");
    fireEvent.pointerLeave(region());
    act(() => vi.advanceTimersByTime(1999));
    expect(
      screen.getByText("Display name saved.").closest("div")
    ).not.toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Display name saved.").closest("div")).toHaveClass(
      "opacity-0"
    );
  });

  it("pauses while focus is inside the region", () => {
    render(<Page />);
    raise("Display name saved.");
    const dismiss = screen.getByRole("button", {
      name: "Dismiss notification",
    });
    act(() => dismiss.focus());
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("Display name saved.")).toBeVisible();
    act(() =>
      screen.getByRole("button", { name: "Raise Token copied." }).focus()
    );
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText("Display name saved.").closest("div")).toHaveClass(
      "opacity-0"
    );
  });

  it("shows at most three, dropping the oldest that would leave anyway", () => {
    render(<Page />);
    raise("You seem to be offline. Your changes haven’t been saved yet.");
    raise("Display name saved.");
    raise("Token copied.");
    raise("Token copied.");
    expect(screen.queryByText("Display name saved.")).toBeNull();
    expect(screen.getAllByText("Token copied.")).toHaveLength(2);
    expect(screen.getByText(/^You seem to be offline/)).toBeVisible();
  });
});
