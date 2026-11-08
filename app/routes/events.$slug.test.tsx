import { screen, within } from "@testing-library/react";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import type { Event } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import EventLayout, { ErrorBoundary, shouldRevalidate } from "./events.$slug";
import EventReadRoute from "./events.$slug._index";

const REVEL: Event = {
  slug: "midwinter-revel",
  name: "Midwinter Revel",
  kind: "event",
  description_md: "A winter feast.",
  performances: [
    {
      piece: null,
      link: {
        url: "https://video.example/x",
        title: "The feast",
        platform: null,
      },
      year: 2025,
      performers: [],
      description_verbatim: "",
    },
  ],
  performances_total: 1,
};

function renderEvent(path: string, answer: () => unknown) {
  return renderRoutes(
    [
      {
        id: "routes/events.$slug",
        path: "/events/:slug",
        loader: () => answer(),
        shouldRevalidate,
        Component: EventLayout,
        ErrorBoundary,
        HydrateFallback: () => null,
        children: [
          { index: true, Component: EventReadRoute },
          { path: "history", element: <p>The history</p> },
        ],
      },
    ],
    path
  );
}

describe("/events/:slug page", () => {
  it("has the head, the description, the performances and the licence", async () => {
    await renderEvent("/events/midwinter-revel", () => ({ event: REVEL }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Midwinter Revel" })
    ).toBeVisible();
    expect(screen.getByText("Event", { selector: "p" })).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Events and venues" }
      )
    ).toHaveAttribute("href", "/events");
    expect(screen.getByText("A winter feast.")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Performances recorded here" })
    ).toHaveTextContent("No particular piece");
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/events/midwinter-revel/history"
    );
  });

  it("keeps only the head on History", async () => {
    await renderEvent("/events/midwinter-revel/history", () => ({
      event: REVEL,
    }));
    expect(screen.getByText("The history")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Performances recorded here" })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "page history" })).toBeNull();
  });

  it("is the event's 404 for a thrown not_found", async () => {
    await renderEvent("/events/x", () => {
      throw data({ kind: "not_found" }, { status: 404 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that event or venue",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderEvent("/events/midwinter-revel", () => ({ event: REVEL }))
    );
  });
});
