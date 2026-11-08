import { screen, within } from "@testing-library/react";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import type { Collection } from "~/schemas/catalogue";
import { renderMarkdown } from "~/server/markdown.server";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import CollectionLayout, {
  ErrorBoundary,
  shouldRevalidate,
} from "./collections.$id";
import CollectionReadRoute from "./collections.$id._index";

// A collection's page from stubbed loader data: the head, the infobox,
// the parts and citations on Read, History's head, and the boundary.

const SONGBOOK: Collection = {
  id: 12,
  name: "The Northmarch Songbook",
  kind: "songbook_website",
  url: "https://songs.example/12",
  is_bardic_resource: true,
  description_md: "The songbook of the kingdom.",
  enumerable: "pdf",
  region: {
    slug: "northmarch",
    facet: "affiliation",
    display_name: "Northmarch",
  },
  parent: {
    id: 7,
    name: "Hall Recordings",
    kind: "youtube_channel",
    url: null,
    is_bardic_resource: false,
  },
  children: [
    {
      id: 13,
      name: "2nd Northmarch Songbook",
      kind: "other",
      url: null,
      is_bardic_resource: true,
    },
  ],
  citations: [
    {
      piece: {
        slug: "the-copper-kettle",
        title: "The Copper Kettle",
        kind: "song",
        secondary_kinds: [],
        conservation_status: "endangered",
        is_stub: false,
      },
      person: null,
      url: "https://songs.example/12/kettle",
      title: "With chords",
      locator: "p. 14",
      roles: ["lyrics"],
    },
  ],
  citations_total: 1,
};

const DESCRIPTION = renderMarkdown(SONGBOOK.description_md);

function renderCollection(path: string, answer: () => unknown) {
  return renderRoutes(
    [
      {
        id: "routes/collections.$id",
        path: "/collections/:id",
        loader: () => answer(),
        shouldRevalidate,
        Component: CollectionLayout,
        ErrorBoundary,
        HydrateFallback: () => null,
        children: [
          { index: true, Component: CollectionReadRoute },
          { path: "history", element: <p>The history</p> },
        ],
      },
    ],
    path
  );
}

describe("/collections/:id page", () => {
  it("has the head: breadcrumbs through the parent, the kind and region", async () => {
    await renderCollection("/collections/12", () => ({
      collection: SONGBOOK,
      description: DESCRIPTION,
    }));
    expect(
      screen.getByRole("heading", { level: 1, name: "The Northmarch Songbook" })
    ).toBeVisible();
    expect(screen.getByText("Songbook website · Northmarch")).toBeVisible();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(crumbs).getByRole("link", { name: "Hall Recordings" })
    ).toHaveAttribute("href", "/collections/7");
  });

  it("has the infobox, the parts, the citations and the licence on Read", async () => {
    await renderCollection("/collections/12", () => ({
      collection: SONGBOOK,
      description: DESCRIPTION,
    }));
    const infobox = screen.getByRole("complementary", {
      name: "The Northmarch Songbook",
    });
    expect(
      within(infobox).getByRole("link", { name: /songs\.example\/12/ })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(
      within(infobox).getByRole("link", { name: "Northmarch" })
    ).toHaveAttribute("href", "/categories/northmarch");
    expect(infobox).toHaveTextContent("Contents can be listedFrom a PDF");
    expect(infobox).toHaveTextContent("Made for bardsYes");
    expect(screen.getByText("The songbook of the kingdom.")).toBeVisible();
    const parts = screen.getByRole("region", { name: "Part collections" });
    expect(
      within(parts).getByRole("link", { name: "2nd Northmarch Songbook" })
    ).toHaveAttribute("href", "/collections/13");
    const citations = screen.getByRole("region", { name: "Citations" });
    expect(
      within(citations).getByRole("table", { name: "Citations" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/collections/12/history"
    );
  });

  it("keeps only the head on History", async () => {
    await renderCollection("/collections/12/history", () => ({
      collection: SONGBOOK,
    }));
    expect(screen.getByText("The history")).toBeVisible();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("region", { name: "Citations" })).toBeNull();
  });

  it("is the collection's 404 for a thrown not_found", async () => {
    await renderCollection("/collections/99", () => {
      throw data({ kind: "not_found" }, { status: 404 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that collection",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderCollection("/collections/12", () => ({
        collection: SONGBOOK,
        description: DESCRIPTION,
      }))
    );
  });
});
