import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loader as rootLoader } from "~/root";
import {
  API_BASE_URL,
  APP_ORIGIN,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { renderRoutes } from "~/test/router";
import Settings from "./settings";

// The settings page with the real root loader, against the fixture API
// through msw.

const fixtures = serveFixtureApi();

afterEach(() => {
  vi.restoreAllMocks();
});

const contributorCookie = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

async function renderSettings(cookie?: string) {
  const request = new Request(`${APP_ORIGIN}/settings`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  await renderRoutes(
    [
      {
        id: "root",
        path: "/",
        loader: () => rootLoader(routeArgs(request)),
        HydrateFallback: () => null,
        children: [{ path: "settings", element: <Settings /> }],
      },
    ],
    "/settings"
  );
  await screen.findByRole("heading", { level: 1, name: "Settings" });
}

describe("settings", () => {
  it("shows the display name from the API and where it comes from", async () => {
    await renderSettings(await contributorCookie());

    expect(screen.getByText("Morwen of the Marches")).toBeInTheDocument();
    expect(
      screen.getByText(
        /^Your display name is the name on the Google or Facebook account you log in with\./
      )
    ).toBeInTheDocument();
  });

  it("says so when the profile can't be loaded, offering Try again", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/me`, () =>
        HttpResponse.json({ code: "internal", message: "x" }, { status: 500 })
      )
    );
    await renderSettings(await contributorCookie());

    expect(
      screen.getByText("We couldn’t load your profile.")
    ).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("offers Log in back to settings when signed out", async () => {
    await renderSettings();

    expect(
      screen.getByText("Log in to see your display name.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fsettings"
    );
  });
});
