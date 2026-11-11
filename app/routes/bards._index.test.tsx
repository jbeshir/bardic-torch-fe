import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { personQuery } from "~/catalogue/query-state";
import type { PersonList, PersonSummary, TermList } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import BardsRoute, { ErrorBoundary } from "./bards._index";

// The /bards page in the browser, from stubbed loader data: every state of
// the list and its filters.

const person = (
  slug: string,
  name: string,
  overrides: Partial<PersonSummary> = {}
): PersonSummary => ({
  slug,
  name,
  kind: "community_bard",
  is_stub: false,
  ...overrides,
});

const PEOPLE = [
  person("wren-of-the-vale", "Wren of the Vale"),
  person("wynne-of-caer-wyn", "Wynne of Caer Wyn", { is_stub: true }),
  person("northmarch-bards", "Northmarch Bards", { kind: "group" }),
];

const listOf = (
  people: readonly PersonSummary[],
  total = people.length
): PersonList => ({
  data: people,
  total,
  letters: [
    { letter: "N", count: 1 },
    { letter: "W", count: 2 },
  ],
});

const term = (slug: string, name: string, parent: string | null = null) => ({
  slug,
  facet: "affiliation" as const,
  name,
  display_name: name,
  parent_slug: parent,
  piece_count: 0,
  person_count: 1,
});

const AFFILIATIONS: TermList["data"] = [
  term("northmarch", "Northmarch"),
  term("barony-of-ashdown", "Barony of Ashdown", "northmarch"),
  term("caer-wyn", "Caer Wyn"),
];

function loaded(
  search: string,
  list: PersonList,
  extra: {
    affiliations?: TermList["data"] | null;
    staleAffiliation?: boolean;
  } = {}
) {
  const { state, canonical } = personQuery.parse(new URLSearchParams(search));
  return () => ({
    state,
    canonical,
    affiliations:
      extra.affiliations === undefined ? AFFILIATIONS : extra.affiliations,
    failure: null,
    list,
    staleAffiliation: extra.staleAffiliation ?? false,
  });
}

function renderBards(search: string, answer: (url: URL) => unknown) {
  return renderRoutes(
    [
      {
        path: "/bards",
        loader: ({ request }) => answer(new URL(request.url)),
        Component: BardsRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/bards${search}`
  );
}

/** Each request answered from its own URL's state. */
const byUrl = (list: PersonList) => (url: URL) => loaded(url.search, list)();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/bards page", () => {
  it("says a stale affiliation was left out", async () => {
    await renderBards("?affiliation=gone-kingdom", (url: URL) =>
      loaded(url.search, listOf(PEOPLE), { staleAffiliation: true })()
    );
    expect(
      screen.getByText("That affiliation no longer exists, so we left it out.")
    ).toBeVisible();
    // Said in the status too, so a client navigation announces it.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 bards. That affiliation no longer exists, so we left it out."
    );
    // Only the count is shown: the Alert above already shows the notice.
    expect(
      screen.getByText(
        ". That affiliation no longer exists, so we left it out."
      )
    ).toHaveClass("sr-only");
  });

  it("applies the filters at once at xl, and keeps the form's state the URL's", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const user = userEvent.setup();
    const router = await renderBards("", byUrl(listOf(PEOPLE)));
    // Open at xl, with JS.
    expect(screen.getByText("Filters").closest("details")).toHaveAttribute(
      "open"
    );
    await user.click(screen.getByRole("checkbox", { name: "Group" }));
    expect(router.state.location.search).toBe("?kind=group");
    // The chip takes it off again; the remounted form forgets it.
    await user.click(
      await screen.findByRole("link", { name: "Remove Kind: Group" })
    );
    expect(router.state.location.search).toBe("");
    // The location changes before the form keyed by it remounts: wait for
    // the remount (seen to lag under a loaded full run), then go on with it.
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Group" })).not.toBeChecked();
    });
    await user.click(screen.getByRole("checkbox", { name: "Poet" }));
    expect(router.state.location.search).toBe("?role=poet");
  });

  it("applies the filters only with Apply below xl, straight to the canonical URL", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const user = userEvent.setup();
    const router = await renderBards("?q=wren", byUrl(listOf(PEOPLE)));
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByRole("checkbox", { name: "Singer" }));
    await user.click(screen.getByRole("checkbox", { name: "Group" }));
    expect(router.state.location.search).toBe("?q=wren");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Affiliation" }),
      "caer-wyn"
    );
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(router.state.location.search).toBe(
      "?q=wren&kind=group&role=singer&affiliation=caer-wyn"
    );
  });

  it("keeps focus on the box just used at xl, so the next Tab goes on from it", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const user = userEvent.setup();
    const router = await renderBards("", byUrl(listOf(PEOPLE)));
    screen.getByRole("checkbox", { name: "Group" }).focus();
    await user.keyboard(" ");
    expect(router.state.location.search).toBe("?kind=group");
    await screen.findByRole("link", { name: "Remove Kind: Group" });
    await waitFor(() => {
      const group = screen.getByRole("checkbox", { name: "Group" });
      expect(group).toBeChecked();
      expect(group).toHaveFocus();
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Affiliation" }),
      "caer-wyn"
    );
    expect(router.state.location.search).toBe(
      "?kind=group&affiliation=caer-wyn"
    );
    await screen.findByRole("link", { name: "Remove Affiliation: Caer Wyn" });
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Affiliation" })
      ).toHaveFocus();
    });
  });

  it("keeps the filters open and Apply focused after an Apply below xl", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const user = userEvent.setup();
    const router = await renderBards("", byUrl(listOf(PEOPLE)));
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByRole("checkbox", { name: "Group" }));
    screen.getByRole("button", { name: "Apply filters" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toBe("?kind=group");
    await screen.findByRole("link", { name: "Remove Kind: Group" });
    await waitFor(() => {
      const apply = screen.getByRole("button", { name: "Apply filters" });
      expect(apply).toHaveFocus();
      expect(apply.closest("details")).toHaveAttribute("open");
    });
  });

  it("moves focus to the results heading after a letter, and says which rows a page shows", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const user = userEvent.setup();
    const router = await renderBards("?page=2", byUrl(listOf(PEOPLE, 120)));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 51–53 of 120 bards"
    );
    const bar = screen.getByRole("navigation", { name: "Bards by letter" });
    await user.click(within(bar).getByRole("link", { name: "W" }));
    expect(router.state.location.search).toBe("?letter=W");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Bards under W" })
      ).toHaveFocus();
    });
  });
});
