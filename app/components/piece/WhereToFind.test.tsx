import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { linkOf, performanceOf, pieceOf } from "~/test/catalogue";
import { renderOnServer, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { RestrictedLinks, WhereToFind } from "./WhereToFind";

const HOST = "private-recordings.example";

const RESTRICTED = pieceOf({
  conservation_status: "restricted",
  is_stub: true,
  links: [
    linkOf({
      url: `https://${HOST}/hoard/revel`,
      title: "At the revel",
      liveness: "dead",
      archived_url: `https://web-archive.example/${HOST}/hoard/revel`,
      roles: ["performance"],
      performances: [performanceOf({ description_verbatim: "Told" })],
    }),
    linkOf({
      url: `https://${HOST}/hoard/text`,
      title: "The text",
      roles: ["text", "licensing_source"],
    }),
  ],
});

describe("WhereToFind", () => {
  it("lists the piece's links by role", async () => {
    await renderWithRouter(
      <WhereToFind
        piece={pieceOf({ links: [linkOf({ roles: ["lyrics"] })] })}
      />
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Lyrics" })
    ).toBeVisible();
  });

  it("says there are no links yet", async () => {
    await renderWithRouter(<WhereToFind piece={pieceOf()} />);
    expect(screen.getByText("No links yet.")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("asks a stub's readers for the first link, leaving the guide to the banner", async () => {
    await renderWithRouter(<WhereToFind piece={pieceOf({ is_stub: true })} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "No links yet" })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Know where this piece lives online or in print? Add the first link."
      )
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "How to contribute" })
    ).toBeNull();
  });

  it("leaves the performance role's group to the Performances section", async () => {
    await renderWithRouter(
      <WhereToFind
        piece={pieceOf({
          links: [
            linkOf({
              url: "https://video.example/revel",
              title: "At the revel",
              roles: ["performance"],
              performances: [performanceOf({ description_verbatim: "Told" })],
            }),
            linkOf({
              url: "https://words.example/text",
              title: "Words",
              roles: ["lyrics"],
            }),
            linkOf({
              url: "https://video.example/both",
              title: "Both ways",
              roles: ["performance", "website"],
              performances: [performanceOf({ description_verbatim: "Sung" })],
            }),
          ],
        })}
      />
    );
    expect(
      screen.queryByRole("heading", { level: 3, name: "Performances" })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: "Lyrics" })
    ).toBeVisible();
    // A link with another role is still listed under that one.
    expect(
      screen.getByRole("heading", { level: 3, name: "Websites" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Both ways/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /At the revel/ })).toBeNull();
  });

  it("points at the performances when they are all it has", async () => {
    await renderWithRouter(
      <WhereToFind
        piece={pieceOf({
          links: [
            linkOf({
              roles: ["performance"],
              performances: [performanceOf({ description_verbatim: "Told" })],
            }),
          ],
        })}
      />
    );
    expect(
      screen.getByText("Its recorded performances are listed below.")
    ).toBeVisible();
  });
});

describe("RestrictedLinks", () => {
  it("is reached with the keyboard: its summary is the first stop", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<RestrictedLinks piece={RESTRICTED} />);
    await user.tab();
    expect(
      screen
        .getByText(
          "Show links (the creator asks that this isn’t shared further)"
        )
        .closest("summary")
    ).toHaveFocus();
  });

  it("keeps every link, performance and source inside one closed disclosure that says why", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<RestrictedLinks piece={RESTRICTED} />);
    const summary = screen.getByText(
      "Show links (the creator asks that this isn’t shared further)"
    );
    const details = summary.closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    expect(document.querySelectorAll("details")).toHaveLength(1);
    // Every anchor to the restricted host is inside it.
    for (const anchor of document.querySelectorAll(`a[href*="${HOST}"]`)) {
      expect(details.contains(anchor)).toBe(true);
    }
    await user.click(summary);
    const body = within(details);
    expect(details.querySelector("p")).toHaveTextContent(
      "The creator has asked that this work isn’t recorded or shared. These links are listed for reference only; please don’t repost them."
    );
    expect(
      body.getByRole("heading", { name: "Licensing sources" })
    ).toBeVisible();
    expect(
      body.getByRole("heading", { name: "Recorded performances", level: 3 })
    ).toBeVisible();
    expect(body.getAllByText("Told").length).toBeGreaterThan(0);
    // The dead link's note stays; its archived copy doesn't.
    expect(body.getByText("This link may be broken")).toBeVisible();
    expect(body.queryByRole("link", { name: /Archived copy/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain("web-archive.example");
    // No prompt to add or record anything, even for a stub.
    expect(screen.queryByRole("link", { name: /contribute/i })).toBeNull();
  });

  it("is closed without JS too", async () => {
    const html = await renderOnServer(<RestrictedLinks piece={RESTRICTED} />);
    expect(html).toMatch(/<details[^>]*><summary/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("says there are no links yet, with no disclosure", async () => {
    await renderWithRouter(
      <RestrictedLinks piece={{ ...RESTRICTED, links: [] }} />
    );
    expect(screen.getByText("No links yet.")).toBeVisible();
    expect(document.querySelector("details")).toBeNull();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<RestrictedLinks piece={RESTRICTED} />)
    );
  });
});
