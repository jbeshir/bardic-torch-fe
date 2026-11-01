import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRoutes } from "~/test/router";
import { NavigationProgress, useSlowNavigation } from "./NavigationProgress";

function Page() {
  const slow = useSlowNavigation();
  return (
    <>
      <NavigationProgress visible={slow} />
      <output aria-label="Slow">{String(slow)}</output>
    </>
  );
}

function bar() {
  return document.querySelector(".h-progress");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("NavigationProgress", () => {
  it("renders nothing when hidden", () => {
    render(<NavigationProgress visible={false} />);
    expect(bar()).toBeNull();
  });

  it("is a decorative 3 px accent bar at the top, sweeping only when motion is allowed", () => {
    render(<NavigationProgress visible />);
    expect(bar()).toHaveAttribute("aria-hidden", "true");
    expect(bar()).toHaveClass("fixed", "top-0", "z-progress");
    const sweep = bar()?.firstElementChild;
    expect(sweep).toHaveClass("bg-accent", "motion-safe:animate-progress");
    expect(sweep?.getAttribute("class")).not.toMatch(/(^| )animate-progress/);
  });

  it("shows only for navigations that take longer than 300 ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finish: () => void = () => undefined;
    const router = await renderRoutes([
      { path: "/", element: <Page /> },
      {
        path: "/slow",
        loader: () =>
          new Promise(resolve => {
            finish = () => resolve(null);
          }),
        element: <Page />,
      },
    ]);
    act(() => {
      void router.navigate("/slow");
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("status", { name: "Slow" })).toHaveTextContent(
      "false"
    );
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("status", { name: "Slow" })).toHaveTextContent(
      "true"
    );
    expect(bar()).not.toBeNull();
    await act(async () => finish());
    expect(screen.getByRole("status", { name: "Slow" })).toHaveTextContent(
      "false"
    );
    expect(bar()).toBeNull();
  });
});
