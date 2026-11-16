import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

function Probe() {
  return <p>{useMediaQuery("(min-width: 1280px)") ? "wide" : "narrow"}</p>;
}

/** A matchMedia whose answer the test changes, telling its listeners. */
function stubMatchMedia(initially: boolean) {
  let matches = initially;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  return {
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

describe("useMediaQuery", () => {
  it("is false in the server render", () => {
    expect(renderToString(<Probe />)).toContain("narrow");
  });

  it("follows the query as it changes, and stops listening when unmounted", () => {
    const media = stubMatchMedia(true);
    const { unmount } = render(<Probe />);
    expect(screen.getByText("wide")).toBeVisible();
    act(() => media.set(false));
    expect(screen.getByText("narrow")).toBeVisible();
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
