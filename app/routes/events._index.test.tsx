import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { eventQuery } from "~/catalogue/query-state";
import type { EventList } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import EventsRoute, { ErrorBoundary } from "./events._index";

function renderEvents(search: string, answer: () => unknown) {
  return renderRoutes(
    [
      {
        path: "/events",
        loader: () => answer(),
        Component: EventsRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/events${search}`
  );
}

function loaded(search: string, list: EventList) {
  const { state, canonical } = eventQuery.parse(new URLSearchParams(search));
  return () => ({ state, canonical, list });
}

const LIST: EventList = {
  data: [
    { slug: "midwinter-revel", name: "Midwinter Revel", kind: "event" },
    { slug: "muster-field", name: "Muster Field", kind: "venue" },
  ],
  total: 2,
};

describe("/events page", () => {
  it("marks the results busy while another kind loads, keeping the old ones", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    let calls = 0;
    await renderEvents("", () => {
      calls += 1;
      if (calls === 1) return loaded("", LIST)();
      return new Promise(resolve => {
        release = () => resolve(loaded("?kind=venue", LIST)());
      });
    });
    const kinds = screen.getByRole("navigation", { name: "Kinds" });
    await user.click(within(kinds).getByRole("link", { name: "Venues" }));
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Muster Field" })).toBeVisible();
    await act(async () => {
      release();
    });
    expect(document.querySelector("[aria-busy]")).toBeNull();
  });

  it("lists the events and venues with their kinds and the kind switch", async () => {
    await renderEvents("", loaded("", LIST));
    expect(
      screen.getByRole("heading", { level: 1, name: "Events and venues" })
    ).toBeVisible();
    expect(screen.getByText("2 events and venues")).toBeVisible();
    const field = screen.getByRole("link", { name: "Muster Field" });
    expect(field).toHaveAttribute("href", "/events/muster-field");
    expect(field.closest("li")).toHaveTextContent("Venue");
    const kinds = screen.getByRole("navigation", { name: "Kinds" });
    expect(within(kinds).getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(kinds).getByRole("link", { name: "Venues" })).toHaveAttribute(
      "href",
      "/events?kind=venue"
    );
  });

  it.each([
    ["venue", "No venues recorded yet"],
    ["event", "No events recorded yet"],
  ])("says when no %s is recorded, offering them all", async (kind, title) => {
    await renderEvents(
      `?kind=${kind}`,
      loaded(`?kind=${kind}`, { data: [], total: 0 })
    );
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Show all events and venues" })
    ).toHaveAttribute("href", "/events");
  });

  it("is the server error for a thrown 500", async () => {
    await renderEvents("", () => {
      throw data({ kind: "server" }, { status: 500 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load the events and venues",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderEvents("", loaded("", LIST))
    );
  });
});
