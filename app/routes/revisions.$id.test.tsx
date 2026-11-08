import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { revisionChanges } from "~/catalogue/diff";
import { revisionHead } from "~/catalogue/revision-head";
import type { Revision } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import RevisionRoute, { ErrorBoundary } from "./revisions.$id";

// The revision page from stubbed loader data: the head for an event's
// revision, the caveat, the links, and the boundary.

const REVISION: Revision = {
  entity_type: "event",
  entity: { slug: "muster-field", name: "Muster Field", kind: "venue" },
  id: 1013,
  base_revision_id: 1012,
  source: "mcp",
  summary: "Described the field",
  author: { display_name: "Morwen of the Marches" },
  contributors: [],
  created_at: "2026-03-12T12:00:00Z",
  snapshot: { name: "Muster Field", kind: "venue", description_md: "Open." },
  base_snapshot: { name: "Muster Field", kind: "venue", description_md: null },
  changed_fields: ["description_md"],
};

function renderRevision(answer: () => unknown) {
  return renderRoutes(
    [
      {
        path: "/revisions/:id",
        loader: () => answer(),
        Component: RevisionRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    "/revisions/1013"
  );
}

const loaded = (revision: Revision) => () => ({
  head: revisionHead(revision),
  changes: revisionChanges(revision),
});

describe("/revisions/:id page", () => {
  it("names the entity as it is now, who made it, and the caveat", async () => {
    await renderRevision(loaded(REVISION));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Revision 1013 of Muster Field",
      })
    ).toBeVisible();
    expect(screen.getByText("12 Mar 2026").closest("p")).toHaveTextContent(
      "12 Mar 2026 · Morwen of the Marches (via the MCP tool)"
    );
    expect(screen.getByText("Described the field").tagName).toBe("BLOCKQUOTE");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map(link => link.getAttribute("href"))
    ).toEqual([
      "/events",
      "/events/muster-field",
      "/events/muster-field/history",
    ]);
    expect(
      screen.getByRole("link", { name: "View the venue as it is now" })
    ).toHaveAttribute("href", "/events/muster-field");
    expect(
      screen.getByRole("link", { name: "Older revision" })
    ).toHaveAttribute("href", "/revisions/1012");
    expect(
      screen.getByText("This is how the revision looks today.")
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 3, name: "Description" })
    ).toBeVisible();
  });

  it("keeps the caveat on a first version, with no summary and no older link", async () => {
    await renderRevision(
      loaded({
        ...REVISION,
        source: "import",
        author: null,
        contributors: ["Archivist"],
        summary: "",
        base_revision_id: null,
        base_snapshot: null,
      })
    );
    expect(
      screen.getByText("This is how the revision looks today.")
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Older revision" })).toBeNull();
    expect(screen.queryByRole("blockquote")).toBeNull();
    expect(
      screen.getByText(/Imported from the original wiki, by Archivist/)
    ).toBeVisible();
  });

  it("goes to the older revision from the keyboard", async () => {
    const router = await renderRevision(loaded(REVISION));
    const user = userEvent.setup();
    screen.getByRole("link", { name: "Older revision" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe("/revisions/1012");
  });

  it("is the revision's 404 for a thrown not_found", async () => {
    await renderRevision(() => {
      throw data({ kind: "not_found" }, { status: 404 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that revision",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderRevision(loaded(REVISION)));
  });
});
