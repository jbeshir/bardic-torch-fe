import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Licence } from "~/schemas/catalogue";
import { linkOf } from "~/test/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { LicensingCard } from "./LicensingCard";

const SOURCE = linkOf({
  url: "https://oral.example/road",
  title: "How the song is passed on",
  roles: ["licensing_source"],
});

const NOTES = [
  {
    type: "paragraph" as const,
    children: [
      { type: "text" as const, value: "Free to perform with credit." },
    ],
  },
];

const card = () => screen.getByRole("heading", { level: 2, name: "Licensing" });

describe("LicensingCard", () => {
  it("is the Licensing section, its heading the infobox's link target", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="piece"
        status="unknown"
        notes={null}
        sources={[]}
      />
    );
    expect(card()).toHaveAttribute("id", "licensing");
  });

  it("shows known licensing with its licence, notes and sources", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="piece"
        status="known"
        licence="cc_by_sa"
        notes={NOTES}
        sources={[SOURCE]}
      />
    );
    expect(screen.getByText("Licensing known")).toBeVisible();
    expect(
      screen
        .getByText("Licensing known")
        .querySelector("svg.tabler-icon-circle-check")
    ).toHaveAttribute("aria-hidden", "true");
    const licence = screen.getByRole("link", {
      name: "Creative Commons Attribution-ShareAlike (external link)",
    });
    expect(licence).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/"
    );
    expect(
      screen.getByText(
        "The version isn’t recorded; check the source for the exact terms."
      )
    ).toBeVisible();
    expect(screen.getByText("Free to perform with credit.")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 3, name: "Sources" })
    ).toBeVisible();
    const source = screen.getByRole("link", {
      name: "How the song is passed on (external link)",
    });
    expect(source).toHaveAttribute("rel", "nofollow ugc noopener");
  });

  it("says when the licensing isn't known, for a piece and for a person", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="piece"
        status="unknown"
        notes={null}
        sources={[]}
      />
    );
    const unknown = screen.getByText(
      "We don’t know how this piece is licensed yet"
    );
    expect(
      unknown.querySelector("svg.tabler-icon-help-circle")
    ).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading", { name: "Sources" })).toBeNull();
  });

  it("names no licence while the licensing isn't known, as the infobox doesn't", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="piece"
        status="unknown"
        licence="cc_by_sa"
        notes={null}
        sources={[]}
      />
    );
    expect(
      screen.getByText("We don’t know how this piece is licensed yet")
    ).toBeVisible();
    expect(screen.queryByText(/Creative Commons/)).toBeNull();
    expect(screen.queryByText(/CC BY-SA/)).toBeNull();
  });

  it("has no licence for a person", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="person"
        status="unknown"
        notes={null}
        sources={[]}
      />
    );
    expect(
      screen.getByText("We don’t know how this person licenses their work yet")
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /Creative Commons/ })).toBeNull();
  });

  it.each([
    ["pd", "Public domain", false],
    ["cc_by", "Creative Commons Attribution", true],
    ["cc_by_sa", "Creative Commons Attribution-ShareAlike", true],
    ["cc_by_nc", "Creative Commons Attribution-NonCommercial", true],
    [
      "cc_by_nc_sa",
      "Creative Commons Attribution-NonCommercial-ShareAlike",
      true,
    ],
    ["cc_by_nd", "Creative Commons Attribution-NoDerivatives", true],
    [
      "cc_by_nc_nd",
      "Creative Commons Attribution-NonCommercial-NoDerivatives",
      true,
    ],
    ["arr", "All rights reserved", false],
    ["other", "Another licence", false],
  ] as const)(
    "names %s “%s”, never with a version",
    async (licence: Licence, label, family) => {
      await renderWithRouter(
        <LicensingCard
          subject="piece"
          status="known"
          licence={licence}
          notes={null}
          sources={[]}
        />
      );
      const body = card().parentElement as HTMLElement;
      expect(body.textContent).not.toMatch(/\d\.\d/);
      const link = within(body).queryByRole("link", {
        name: `${label} (external link)`,
      });
      if (family) {
        // The family's overview, never a versioned deed.
        expect(link).toHaveAttribute(
          "href",
          "https://creativecommons.org/licenses/"
        );
      } else {
        expect(link).toBeNull();
        expect(screen.getByText(label, { exact: true })).toBeVisible();
      }
    }
  );

  it("says where a restricted piece's sources are instead of listing them", async () => {
    await renderWithRouter(
      <LicensingCard
        subject="piece"
        status="known"
        licence="arr"
        notes={null}
        sources={[SOURCE]}
        sourcesHidden
      />
    );
    expect(
      screen.getByText("Sources are listed under Where it has been recorded.")
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /passed on/ })).toBeNull();
  });

  it("ends with the etiquette note, linking to the checklist", async () => {
    await renderWithRouter(
      <LicensingCard subject="piece" status="known" notes={null} sources={[]} />
    );
    expect(
      screen.getByText(/^Ask the creator before recording or adapting a piece/)
    ).toHaveTextContent(
      "Ask the creator before recording or adapting a piece unless its licence says you may. See the bard preference checklist."
    );
    expect(
      screen.getByRole("link", { name: "bard preference checklist" })
    ).toHaveAttribute("href", "/help/bard-preference-checklist");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <LicensingCard
          subject="piece"
          status="known"
          licence="cc_by"
          notes={NOTES}
          sources={[SOURCE]}
        />
      )
    );
  });
});
