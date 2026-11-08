import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "~/schemas/catalogue";
import { linkOf, personOf, pieceSummaryOf, profileOf } from "~/test/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import BardLayout, { ErrorBoundary } from "./bards.$slug";
import BardRead from "./bards.$slug._index";

// A bard's page in the browser, from stubbed loader data: the identity-only
// page of a person with no page, and every part of a profile's page. The
// loader is bards.$slug.ssr.test.ts's.

type Profile = NonNullable<Person["profile"]>;

function renderBard(answer: () => unknown, slug = "wren-of-the-vale") {
  return renderRoutes(
    [
      {
        path: "/bards/:slug",
        loader: () => answer(),
        Component: BardLayout,
        ErrorBoundary,
        HydrateFallback: () => null,
        children: [{ index: true, Component: BardRead }],
      },
    ],
    `/bards/${slug}`
  );
}

const NO_PROSE = { notes: null, licensingNotes: null };
const loaded = (person: Person) => () => ({ person, markdown: NO_PROSE });
const withProfile = (profile: Partial<Profile>, person: Partial<Person> = {}) =>
  loaded(personOf({ ...person, profile: profileOf(profile) }));

const HOLLIS = personOf({
  slug: "hollis-fenn",
  name: "Hollis Fenn",
  is_stub: true,
  status: "prefers_no_page",
  status_date: "2026-03-01",
  status_source_url: "https://requests.example/statements/12",
  profile: null,
});

const work = (
  slug: string,
  role: Profile["works"][number]["role"],
  extra: Partial<Profile["works"][number]> = {}
) => ({
  piece: pieceSummaryOf(slug, slug.replace(/-/g, " ")),
  role,
  certainty: "certain" as const,
  part: null,
  ...extra,
});

const infobox = () =>
  screen.getByRole("complementary", { name: "About this bard" });
const value = (label: string) =>
  within(infobox()).getByText(label, { selector: "dt" })
    .nextElementSibling as HTMLElement;

describe("/bards/:slug, a person with no page", () => {
  it("is their identity only: the name, the kind and the banner with their statement", async () => {
    await renderBard(loaded(HOLLIS), "hollis-fenn");
    expect(
      screen.getByRole("heading", { level: 1, name: "Hollis Fenn" })
    ).toBeVisible();
    expect(screen.getByText("Community bard")).toBeVisible();
    expect(
      screen.getByText("Hollis Fenn has asked not to have a page here.")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Read their statement (external link)" })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("has no History tab, and a licence line without the history", async () => {
    await renderBard(loaded(HOLLIS), "hollis-fenn");
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
    expect(screen.queryByRole("link", { name: "page history" })).toBeNull();
    expect(screen.getByText(/^Text is available/)).toHaveTextContent(
      /adapted from the original Bardic Torch wiki\.$/
    );
  });

  it("has no statement link when there is none", async () => {
    await renderBard(
      loaded({ ...HOLLIS, status_source_url: null }),
      "hollis-fenn"
    );
    expect(screen.queryByRole("link", { name: /statement/ })).toBeNull();
  });
});

describe("/bards/:slug, a profile", () => {
  it("has the breadcrumbs, the meta line and the Read and History tabs", async () => {
    await renderBard(withProfile({ pronouns: "she/her" }));
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Bards" }
      )
    ).toHaveAttribute("href", "/bards");
    expect(screen.getByText("Community bard · she/her")).toBeVisible();
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/bards/wren-of-the-vale/history"
    );
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/bards/wren-of-the-vale/history"
    );
  });

  it.each([
    ["community_bard", "Community bard · Died 3 Oct 2026"],
    ["historical", "Historical figure · Died 3 Oct 2026"],
    ["group", "Group · Disbanded 3 Oct 2026"],
  ] as const)("says a deceased %s is “%s”", async (kind, line) => {
    await renderBard(
      withProfile({}, { kind, status: "deceased", status_date: "2026-10-03" })
    );
    expect(screen.getByText(line)).toBeVisible();
  });

  it("says a stub is one", async () => {
    await renderBard(withProfile({}, { is_stub: true }));
    expect(screen.getByText("This page is a stub.")).toBeVisible();
    expect(
      screen.getByText(
        "We know this person exists but haven’t gathered much yet."
      )
    ).toBeVisible();
  });

  it("lists other names by kind, never the redirects, and the roles in order", async () => {
    await renderBard(
      withProfile({
        aliases: [
          { name: "Wren", kind: "legal" },
          { name: "Wren Vale-Singer", kind: "sca" },
          { name: "The Vale Sparrow", kind: "stage" },
          { name: "Wrennie", kind: "nickname" },
          { name: "Wren Reedpipe", kind: "former" },
          { name: "Wren V.", kind: "redirect" },
        ],
        roles: ["singer", "songwriter", "storyteller"],
      })
    );
    expect(
      within(value("Also known as"))
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual([
      "Wren (Name)",
      "Wren Vale-Singer (SCA name)",
      "The Vale Sparrow (Stage name)",
      "Wrennie (Nickname)",
      "Wren Reedpipe (Former name)",
    ]);
    expect(value("Roles")).toHaveTextContent("Singer, Songwriter, Storyteller");
  });

  it("shows affiliations as chips, the website and the status when not active", async () => {
    await renderBard(
      withProfile(
        {
          affiliations: [
            {
              slug: "barony-of-ashdown",
              facet: "affiliation",
              display_name: "Barony of Ashdown",
            },
          ],
          links: [
            linkOf({
              url: "https://wren.example/",
              title: "Wren’s page",
              roles: ["website"],
            }),
          ],
        },
        { status: "deceased", status_date: "2026-10-03" }
      )
    );
    expect(
      within(value("Affiliations")).getByRole("link", {
        name: "Barony of Ashdown",
      })
    ).toHaveAttribute("href", "/categories/barony-of-ashdown");
    const website = within(value("Website")).getByRole("link", {
      name: "Wren’s page (external link)",
    });
    expect(website).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(value("Status")).toHaveTextContent("Died 3 Oct 2026");
  });

  it("has no status row for an active person, and an empty roles row", async () => {
    await renderBard(withProfile({}));
    expect(
      within(infobox()).queryByText("Status", { selector: "dt" })
    ).toBeNull();
    expect(value("Roles")).toHaveTextContent("Not recorded");
  });

  it.each([
    ["known", "Known", "Licensing known"],
    [
      "unknown",
      "Unknown",
      "We don’t know how this person licenses their work yet",
    ],
  ] as const)(
    "sums up %s licensing in the infobox and the card",
    async (status, summary, line) => {
      await renderBard(withProfile({ licensing_status: status }));
      expect(within(value("Licensing")).getByRole("link")).toHaveTextContent(
        summary
      );
      expect(screen.getByText(line)).toBeVisible();
    }
  );

  it("lists works in one table with one role, with their badge, part and certainty", async () => {
    await renderBard(
      withProfile({
        works: [
          work("the-copper-kettle", "tune", {
            part: "tune",
            certainty: "probable",
            piece: pieceSummaryOf(
              "the-copper-kettle",
              "The Copper Kettle",
              "endangered"
            ),
          }),
          work("midwinter-carol", "tune"),
        ],
        works_total: 2,
      })
    );
    const works = screen.getByRole("region", { name: "Works" });
    expect(within(works).queryByRole("heading", { level: 3 })).toBeNull();
    const rows = within(works).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent(
      "The Copper KettleConservation status: EndangeredTune (tune) (probably)"
    );
    expect(
      within(rows[0] as HTMLElement).getByRole("link", {
        name: "The Copper Kettle",
      })
    ).toHaveAttribute("href", "/pieces/the-copper-kettle");
    expect(within(works).queryByText(/more not listed here/)).toBeNull();
  });

  it("groups works by role with two or more, and says how many more there are", async () => {
    await renderBard(
      withProfile({
        works: [work("a", "tune"), work("b", "lyrics"), work("c", "lyrics")],
        works_total: 8,
      })
    );
    const works = screen.getByRole("region", { name: "Works" });
    expect(
      within(works)
        .getAllByRole("heading", { level: 3 })
        .map(h => h.textContent)
    ).toEqual(["Words (2)", "Tunes (1)"]);
    expect(within(works).getByText("and 5 more not listed here")).toBeVisible();
  });

  it("lists performances, a restricted piece's with no link off its page", async () => {
    await renderBard(
      withProfile({
        performances: [
          {
            piece: null,
            link: {
              url: "https://video.example/revel",
              title: "Midwinter Revel 2025",
              platform: null,
            },
            year: 2025,
            event: {
              slug: "midwinter-revel",
              name: "Midwinter Revel",
              kind: "event",
            },
            description_verbatim: "Wren opens the evening",
          },
          {
            piece: pieceSummaryOf(
              "the-dragons-hoard",
              "The Dragon’s Hoard",
              "restricted"
            ),
            link: {
              url: "https://private-recordings.example/hoard",
              title: "Hoard",
              platform: null,
            },
            year: null,
            event: null,
            description_verbatim: "Spoken to a hushed field.",
          },
        ],
        performances_total: 203,
      })
    );
    const performances = screen.getByRole("region", { name: "Performances" });
    const [first, second] = within(performances).getAllByRole("listitem");
    expect(first).toHaveTextContent("2025No particular piece");
    expect(first).toHaveTextContent("At Midwinter Revel");
    expect(first).toHaveTextContent("As described: Wren opens the evening");
    expect(
      within(first as HTMLElement).getByRole("link", {
        name: "Midwinter Revel 2025 (external link)",
      })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(
      within(second as HTMLElement).getByRole("link", {
        name: "The Dragon’s Hoard",
      })
    ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
    expect(second).toHaveTextContent("Conservation status: Restricted");
    expect(second).toHaveTextContent("Link not shown: see the piece page");
    expect(document.body.innerHTML).not.toContain("private-recordings.example");
    expect(
      within(performances).getByText("and 201 more not listed here")
    ).toBeVisible();
  });

  it.each([
    ["member_of", "outgoing", "Member of"],
    ["member_of", "incoming", "Members"],
    ["heir_of", "outgoing", "Heir of"],
    ["heir_of", "incoming", "Heirs"],
    ["same_as", "outgoing", "Also recorded as"],
    ["same_as", "incoming", "Also recorded as"],
  ] as const)(
    "reads a %s %s relation as “%s”",
    async (type, direction, label) => {
      await renderBard(
        withProfile({
          relations: [
            {
              type,
              direction,
              person: {
                slug: "northmarch-bards",
                name: "Northmarch Bards",
                kind: "group",
                is_stub: false,
              },
            },
          ],
        })
      );
      const group = screen.getByRole("region", { name: label });
      expect(group).toHaveTextContent(/Northmarch Bards\s*Group$/);
      expect(
        within(group).getByRole("link", { name: "Northmarch Bards" })
      ).toHaveAttribute("href", "/bards/northmarch-bards");
    }
  );

  it("lists external profiles first, then the other links by role", async () => {
    await renderBard(
      withProfile({
        links: [
          linkOf({ url: "https://wren.example/", roles: ["website"] }),
          linkOf({
            url: "https://hub.example/wren",
            roles: ["external_profile"],
          }),
          linkOf({ url: "https://words.example/", roles: ["lyrics"] }),
        ],
      })
    );
    const links = screen.getByRole("region", { name: "Links" });
    expect(
      within(links)
        .getAllByRole("heading", { level: 3 })
        .map(h => h.textContent)
    ).toEqual(["External profiles", "Lyrics", "Websites"]);
  });

  it("leaves out the sections with nothing, keeping the licensing card", async () => {
    await renderBard(withProfile({}));
    expect(
      screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent)
    ).toEqual(["About this bard", "Licensing"]);
  });

  it("names a group's infobox for a group", async () => {
    await renderBard(withProfile({}, { kind: "group" }));
    expect(
      screen.getByRole("complementary", { name: "About this group" })
    ).toBeVisible();
  });

  it("is walked with Tab from the breadcrumbs to the tabs", async () => {
    const user = userEvent.setup();
    await renderBard(withProfile({}));
    await user.tab();
    expect(screen.getByRole("link", { name: "Bards" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Read" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "History" })).toHaveFocus();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderBard(
        withProfile({
          roles: ["singer"],
          works: [work("a", "tune"), work("b", "lyrics")],
          works_total: 2,
        })
      )
    );
  });
});

describe("/bards/:slug failures", () => {
  it.each([
    [{ kind: "not_found" }, 404, "We couldn’t find that bard"],
    [{ kind: "server" }, 500, "We couldn’t load this bard"],
    [{ kind: "resting", retryAfter: 60 }, 503, "Bardic Torch is resting"],
    [{ kind: "bad_gateway" }, 502, "Something went wrong"],
  ])("shows %o as “%s”", async (failure, status, title) => {
    await renderBard(() => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  });

  it("shows anything else thrown as a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderBard(() => {
      throw new Error("boom");
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load this bard",
      })
    ).toBeVisible();
    vi.restoreAllMocks();
  });
});
