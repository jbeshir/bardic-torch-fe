import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRoutes } from "~/test/router";
import { ErrorBoundary } from "./root";

const sentry = vi.hoisted(() => ({
  initialised: false,
  captured: [] as unknown[],
}));

vi.mock("@sentry/remix", () => ({
  isInitialized: () => sentry.initialised,
  captureRemixErrorBoundaryError: (error: unknown) => {
    sentry.captured.push(error);
    return "5e1f00d2a4b94c7e";
  },
}));

function renderFailure(thrown: unknown) {
  return renderRoutes([
    {
      id: "root",
      path: "*",
      loader: () => {
        throw thrown;
      },
      Component: () => null,
      ErrorBoundary,
    },
  ]);
}

afterEach(() => {
  sentry.initialised = false;
  sentry.captured.length = 0;
  vi.restoreAllMocks();
});

describe("root ErrorBoundary", () => {
  it("reports the error and shows Sentry's event id as the reference when Sentry is set up", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    sentry.initialised = true;
    const error = new Error("boom");
    await renderFailure(error);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Something went wrong",
      })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Reference: 5e1f00d2a4b94c7e")
      ).toBeInTheDocument()
    );
    expect(sentry.captured).toEqual([error]);
  });

  it("shows no reference without Sentry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderFailure(new Error("boom"));
    await screen.findByRole("heading", {
      level: 1,
      name: "Something went wrong",
    });
    expect(screen.queryByText(/Reference/)).toBeNull();
    expect(screen.queryByText(/include the reference/)).toBeNull();
  });

  it("doesn't report a 404, and shows the not-found page", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    sentry.initialised = true;
    await renderFailure(new Response(null, { status: 404 }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "We couldn’t find that page",
      })
    ).toBeInTheDocument();
    expect(sentry.captured).toEqual([]);
  });

  it("keeps the home link, a main landmark and the help links", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderFailure(new Error("boom"));
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: "Bardic Torch" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "content");
    expect(screen.getByRole("list", { name: "Help" })).toBeInTheDocument();
  });
});
