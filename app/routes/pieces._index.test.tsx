import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { pieceQuery } from "~/catalogue/query-state";
import type {
  PieceList,
  PieceSummary,
  TermListItem,
} from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { routeArgs } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import PiecesRoute, { ErrorBoundary, loader } from "./pieces._index";

// The /pieces page in the browser, from stubbed loader data: the facet
// behaviour (apply at once from xl, Show results below, the drawer, focus).

function piece(n: number, overrides: Partial<PieceSummary> = {}): PieceSummary {
  return {
    slug: `drill-song-${n}`,
    title: `Drill Song ${n}`,
    kind: "song",
    conservation_status: "unassessed",
    is_stub: false,
    credit_names: [],
    ...overrides,
  };
}

function listOf(
  pieces: readonly PieceSummary[],
  total = pieces.length
): PieceList {
  return {
    data: pieces,
    total,
    facets: {
      terms: total > 0 ? [{ slug: "warlike", count: total }] : [],
      kinds: total > 0 ? [{ kind: "song", count: total }] : [],
      conservation_statuses: [],
      letters: [
        { letter: "D", count: 205 },
        { letter: "T", count: 5 },
      ],
    },
  };
}

type Answer = () => unknown;

/** /pieces{search} with a loader answering `answer` for every request. */
function renderPieces(search: string, answer: Answer) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        loader: () => answer(),
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

function term(
  slug: string,
  facet: TermListItem["facet"],
  display: string
): TermListItem {
  return {
    slug,
    facet,
    name: display,
    display_name: display,
    parent_slug: null,
    piece_count: 10,
    person_count: 0,
  };
}

const TERMS = [
  term("warlike", "mood", "Warlike"),
  term("eerie", "mood", "Eerie"),
  term("sea", "topic", "The sea"),
];

/** The loader data for `search` with `list`, as the loader returns it. */
function loaded(
  search: string,
  list: PieceList,
  {
    terms = TERMS,
    stale = [],
  }: {
    readonly terms?: readonly TermListItem[] | null;
    readonly stale?: readonly string[];
  } = {}
) {
  const { state, canonical } = pieceQuery.parse(new URLSearchParams(search));
  return () => ({ state, canonical, terms, stale, failure: null, list });
}

const FIFTY = Array.from({ length: 50 }, (_, i) => piece(i + 1));

describe("/pieces page", () => {
  it("marks the results busy while a letter loads, keeping the old ones", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    let calls = 0;
    await renderPieces("", () => {
      calls += 1;
      if (calls === 1) return loaded("", listOf(FIFTY, 249))();
      return new Promise(resolve => {
        release = () =>
          resolve(
            loaded(
              "?letter=T",
              listOf([piece(1, { title: "Tavern Round" })], 1)
            )()
          );
      });
    });
    const results = () => screen.getByRole("status").closest("section");
    expect(results()).not.toHaveAttribute("aria-busy");
    await user.click(screen.getByRole("link", { name: "T" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toBeVisible();
    await act(async () => {
      release();
    });
    expect(results()).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("link", { name: "Tavern Round" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 piece");
  });
});

// ---------------------------------------------------------------------------
// C2.2: the facet column, its chips and the stale-term notice

/**
 * /pieces{search} with a loader answering each request from its own URL,
 * recording the queries it was asked for.
 */
async function renderLive(
  search: string,
  options: Parameters<typeof loaded>[2] = {}
) {
  const asked: string[] = [];
  const router = await renderRoutes(
    [
      {
        path: "/pieces",
        loader: ({ request }) => {
          const query = new URL(request.url).search;
          asked.push(query);
          return loaded(query, listOf(FIFTY.slice(0, 3), 3), options)();
        },
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
  return { router, asked };
}

/** A screen from xl, where the facet column applies each change. */
function wideScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1280px)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("/pieces facets", () => {
  it("has a chip for every selected value, in the URL's order, each without it", async () => {
    await renderLive(
      "?q=kettle&term=sea&term=warlike&kind=song&status=endangered&stub=false&letter=K"
    );
    const chips = screen.getByRole("region", { name: "Selected filters" });
    expect(
      within(chips)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      [
        "Remove Search: ‘kettle’",
        "/pieces?term=sea&term=warlike&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Topic: The sea",
        "/pieces?q=kettle&term=warlike&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Mood: Warlike",
        "/pieces?q=kettle&term=sea&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Kind: Song",
        "/pieces?q=kettle&term=sea&term=warlike&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Conservation: Endangered",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&stub=false&letter=K",
      ],
      [
        "Remove Hiding stubs",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&status=endangered&letter=K",
      ],
      [
        "Remove Letter: K",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&status=endangered&stub=false",
      ],
      ["Clear all", "/pieces"],
    ]);
    for (const link of within(chips).getAllByRole("link")) {
      expect(link).toHaveAttribute("rel", "nofollow");
    }
  });

  it("applies the ticks below xl only with Show results, in one request to the canonical URL", async () => {
    const user = userEvent.setup();
    const { router, asked } = await renderLive("?letter=D&page=2");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    expect(asked).toEqual(["?letter=D&page=2"]);
    await user.click(screen.getByRole("button", { name: "Show results" }));
    expect(router.state.location.search).toBe("?kind=song&letter=D");
    expect(asked).toEqual(["?letter=D&page=2", "?kind=song&letter=D"]);
  });

  it("applies each change at once from xl, keeping focus on the box", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router, asked } = await renderLive("");
    expect(
      screen.queryByRole("button", { name: "Apply filters" })
    ).toBeVisible();
    screen.getByRole("checkbox", { name: /^Song/ }).focus();
    await user.keyboard(" ");
    expect(router.state.location.search).toBe("?kind=song");
    expect(asked).toEqual(["", "?kind=song"]);
    // The form was rebuilt from the new URL; the same box has focus.
    await waitFor(() => {
      const song = screen.getByRole("checkbox", { name: /^Song/ });
      expect(song).toBeChecked();
      expect(song).toHaveFocus();
    });
  });

  it("never re-adds a value its chip removed, and Back restores the boxes", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router } = await renderLive("");
    await user.click(screen.getByRole("checkbox", { name: /^Warlike/ }));
    expect(router.state.location.search).toBe("?term=warlike");
    await user.click(
      await screen.findByRole("link", { name: "Remove Mood: Warlike" })
    );
    expect(router.state.location.search).toBe("");
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "Remove Mood: Warlike" })
      ).toBeNull();
    });
    expect(
      screen.getByRole("checkbox", { name: /^Warlike/ })
    ).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    expect(router.state.location.search).toBe("?kind=song");
    expect(
      await screen.findByRole("link", { name: "Remove Kind: Song" })
    ).toBeVisible();
    await act(async () => {
      await router.navigate(-1);
    });
    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe("?term=warlike");
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /^Warlike/ })).toBeChecked();
    });
    expect(screen.getByRole("checkbox", { name: /^Song/ })).not.toBeChecked();
  });
});

// ---------------------------------------------------------------------------
// C2.3: the facet drawer, below xl with JS

/** Escape on the open dialog (jsdom's stand-in fires `cancel`). */
function pressEscape() {
  act(() => {
    fireEvent(
      document.querySelector("dialog[open]") as HTMLDialogElement,
      new Event("cancel", { cancelable: true })
    );
  });
}

describe("/pieces facet drawer", () => {
  it("opens from the keyboard, focus on Close, and Escape discards the unapplied ticks", async () => {
    const user = userEvent.setup();
    const { router } = await renderLive("?letter=D");
    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const drawer = screen.getByRole("dialog", { name: "Filter pieces" });
    expect(
      within(drawer).getAllByRole("button", { name: "Close filters" })[0]
    ).toHaveFocus();
    await user.click(within(drawer).getByRole("checkbox", { name: /^Song/ }));
    pressEscape();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(router.state.location.search).toBe("?letter=D");
    await user.click(trigger);
    expect(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: /^Song/,
      })
    ).not.toBeChecked();
  });

  it("shows the results on Show results: the canonical URL, the drawer closed, focus back on Filters", async () => {
    const user = userEvent.setup();
    const { router, asked } = await renderLive("?q=kettle&page=2");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const drawer = screen.getByRole("dialog", { name: "Filter pieces" });
    await user.click(
      within(drawer).getByRole("checkbox", { name: /^Warlike/ })
    );
    await user.click(within(drawer).getByRole("radio", { name: "Stubs only" }));
    await user.click(
      within(drawer).getByRole("button", { name: "Show results" })
    );
    expect(router.state.location.search).toBe(
      "?q=kettle&term=warlike&stub=true"
    );
    expect(asked).toEqual([
      "?q=kettle&page=2",
      "?q=kettle&term=warlike&stub=true",
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const trigger = screen.getByRole("button", {
      name: "Filters (2 selected)",
    });
    expect(trigger).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Remove Mood: Warlike" })
    ).toBeVisible();
  });

  it("leaves nothing of the drawer behind when Show results meets an outage", async () => {
    const user = userEvent.setup();
    let calls = 0;
    await renderPieces("", () => {
      calls += 1;
      if (calls === 1) return loaded("", listOf(FIFTY, 249))();
      throw data({ kind: "try_again" }, { status: 503 });
    });
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: /^Song/,
      })
    );
    await user.click(screen.getByRole("button", { name: "Show results" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Bardic Torch is resting",
      })
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.documentElement).not.toHaveClass("overflow-hidden");
  });
});

describe("/pieces focus and status after the list changes in place", () => {
  it("moves focus to the results heading when the letter used becomes text", async () => {
    const user = userEvent.setup();
    const { router } = await renderLive("");
    const bar = screen.getByRole("navigation", { name: "Pieces by letter" });
    await user.click(within(bar).getByRole("link", { name: "T" }));
    expect(router.state.location.search).toBe("?letter=T");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Pieces under T" })
      ).toHaveFocus();
    });
  });

  it("never pulls focus back into the facet column after a chip or a letter", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router } = await renderLive("?term=warlike");
    // A box had focus once; then the reader went on to a chip.
    screen.getByRole("checkbox", { name: /^Warlike/ }).focus();
    await user.click(
      screen.getByRole("link", { name: "Remove Mood: Warlike" })
    );
    expect(router.state.location.search).toBe("");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "All pieces" })
      ).toHaveFocus();
    });
  });
});

// The facet form against the real loader (fixture API through msw).
serveFixtureApi();

/** The loader's answer for `/pieces{search}`: a thrown Response is returned. */
async function loaderAnswer(search: string): Promise<unknown> {
  try {
    return await loader(
      routeArgs(new Request(`https://app.test/pieces${search}`), {
        pattern: "/pieces",
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

/** /pieces{search} rendered from the real loader. */
function renderWithLoader(search: string) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        loader: ({ request }) =>
          loader(routeArgs(request, { pattern: "/pieces" })),
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

/**
 * The query the facet form sends without JS: its fields in DOM order. The
 * page is rendered with JS (jsdom) and narrow, so the form is the drawer's;
 * it has the same fields as the column the server renders.
 */
function nativeSubmission(): string {
  const form = screen.getByRole("dialog").querySelector("form");
  if (!form) throw new Error("no facet form");
  const params = new URLSearchParams();
  for (const [name, value] of new FormData(form)) {
    if (typeof value === "string") params.append(name, value);
  }
  return `?${params}`;
}

describe("/pieces: the facet form's own GET", () => {
  it.each([
    ["nothing set", ""],
    ["a letter", "?letter=T"],
    ["a search", "?q=kettle"],
    ["a category and a kind", "?term=eerie&kind=poem"],
    ["every filter", "?q=song&term=warlike&kind=song&stub=false&letter=S"],
  ])("is answered 200, after at most one 301, for %s", async (_why, search) => {
    await renderWithLoader(search);
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sent = nativeSubmission();
    let result = await loaderAnswer(sent);
    if (result instanceof Response) {
      expect(result.status, `GET /pieces${sent}`).toBe(301);
      const target = result.headers.get("Location") ?? "";
      result = await loaderAnswer(target.slice("/pieces".length));
    }
    expect(result, `GET /pieces${sent}`).not.toBeInstanceOf(Response);
  });
});
