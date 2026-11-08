import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { linkOf } from "~/test/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { LinkGroups } from "./LinkGroups";

// A piece's or a person's links by role (plan §4.5): the groups, a link
// under each of its roles, and the rows' parts and liveness notes.

const groupNames = () =>
  screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent);

describe("LinkGroups", () => {
  it("groups the links by role, in the API's order, with a link under each of its roles", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({
            url: "https://example.org/chords",
            title: "With chords",
            roles: ["text", "lyrics", "sheet_music"],
          }),
          linkOf({
            url: "https://example.org/official",
            title: "Official page",
            roles: ["official"],
          }),
        ]}
      />
    );
    expect(groupNames()).toEqual(["Official", "Lyrics", "Text", "Sheet music"]);
    expect(
      screen.getAllByRole("link", { name: "With chords (external link)" })
    ).toHaveLength(3);
  });

  it("labels every role", async () => {
    const roles = [
      "official",
      "lyrics",
      "text",
      "sheet_music",
      "dance_instructions",
      "text_source",
      "translation",
      "performance",
      "licensing_source",
      "website",
      "external_profile",
      "other",
    ] as const;
    await renderWithRouter(
      <LinkGroups links={[linkOf({ roles: [...roles] })]} />
    );
    expect(groupNames()).toEqual([
      "Official",
      "Lyrics",
      "Text",
      "Sheet music",
      "Dance instructions",
      "Text sources",
      "Translations",
      "Performances",
      "Licensing sources",
      "Websites",
      "External profiles",
      "Other",
    ]);
  });

  it("puts the roles asked for first", async () => {
    await renderWithRouter(
      <LinkGroups
        first={["external_profile"]}
        links={[
          linkOf({ url: "https://a.example", roles: ["website"] }),
          linkOf({ url: "https://b.example", roles: ["external_profile"] }),
        ]}
      />
    );
    expect(groupNames()).toEqual(["External profiles", "Websites"]);
  });

  it("names a link by its title, else its host, and never follows or credits a reader's URL", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({ url: "https://named.example/a", title: "A named link" }),
          linkOf({ url: "https://www.untitled.example/very/long/path" }),
        ]}
      />
    );
    const named = screen.getByRole("link", {
      name: "A named link (external link)",
    });
    const untitled = screen.getByRole("link", {
      name: "www.untitled.example (external link)",
    });
    for (const link of [named, untitled]) {
      expect(link).toHaveAttribute("rel", "nofollow ugc noopener");
    }
    expect(untitled).toHaveAttribute(
      "href",
      "https://www.untitled.example/very/long/path"
    );
  });

  it("shows an address that isn't a web one as text", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[linkOf({ url: "javascript:alert(1)", title: "X" })]}
      />
    );
    expect(screen.getByText("X")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("captions the platform, the kind of place and when a working link was checked", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({
            title: "Kettle",
            platform: "example.org",
            place_type: "community_archive",
            liveness: "ok",
            last_checked_at: "2026-10-01T09:30:00Z",
            description: "The words and a tune.",
          }),
        ]}
      />
    );
    expect(
      screen.getByText("example.org · community archive · Checked 1 Oct 2026")
    ).toHaveClass("text-caption");
    expect(screen.getByText("The words and a tune.")).toBeVisible();
  });

  it("says which collection a link is in, as an internal link, with its locator", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({
            title: "Kettle",
            collection: { id: 12, name: "The Northmarch Songbook" },
            locator: "p. 14",
          }),
        ]}
      />
    );
    const collection = screen.getByRole("link", {
      name: "The Northmarch Songbook",
    });
    expect(collection).toHaveAttribute("href", "/collections/12");
    expect(collection).not.toHaveAttribute("rel");
    expect(collection.parentElement).toHaveTextContent(
      "In The Northmarch Songbook (p. 14)"
    );
  });

  it("warns of a dead link and offers its archived copy", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({
            title: "Old words",
            liveness: "dead",
            last_checked_at: "2026-10-01T09:30:00Z",
            archived_url: "https://web-archive.example/2022/kettle",
          }),
        ]}
      />
    );
    const note = screen.getByText("This link may be broken");
    expect(note.closest("p")).toHaveClass("text-warning-fg");
    expect(
      note.querySelector("svg.tabler-icon-alert-triangle")
    ).toHaveAttribute("aria-hidden", "true");
    const archive = screen.getByRole("link", {
      name: "Archived copy (external link)",
    });
    expect(archive).toHaveAttribute(
      "href",
      "https://web-archive.example/2022/kettle"
    );
    expect(archive).toHaveAttribute("rel", "nofollow ugc noopener");
    // A dead link isn't "Checked".
    expect(screen.queryByText(/Checked/)).toBeNull();
  });

  it("warns of a dead link without an archive, and offers no archive when told not to", async () => {
    await renderWithRouter(
      <LinkGroups
        archive={false}
        links={[
          linkOf({
            liveness: "dead",
            archived_url: "https://web-archive.example/2022/kettle",
          }),
        ]}
      />
    );
    expect(screen.getByText("This link may be broken")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Archived copy/ })).toBeNull();
  });

  it("says when a site wouldn't be checked, and says nothing for a working or unchecked link", async () => {
    await renderWithRouter(
      <LinkGroups
        links={[
          linkOf({ url: "https://a.example", liveness: "blocked" }),
          linkOf({ url: "https://b.example", liveness: "ok" }),
          linkOf({ url: "https://c.example", liveness: "unknown" }),
        ]}
      />
    );
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(
      "This site wouldn’t let us check the link"
    );
    expect(rows[1]).toHaveTextContent(/^b\.example \(external link\)$/);
    expect(rows[2]).toHaveTextContent(/^c\.example \(external link\)$/);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <LinkGroups
          links={[
            linkOf({ liveness: "dead", archived_url: "https://a.example" }),
          ]}
        />
      )
    );
  });
});
