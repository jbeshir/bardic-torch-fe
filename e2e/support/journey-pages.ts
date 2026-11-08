import { expect, type Locator, type Page } from "@playwright/test";
import type { Phase } from "./checkpoints";
import { createFixtureUser, outageNext } from "./fixture-api";
import { waitForHydration } from "./hydration";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
} from "./layout";
import { accountTrigger, appBar } from "./shell";
import { test } from "./test";

/**
 * Every page a reader can land on, in one table, and the layout sweep each
 * one gets (R20, WCAG 2.2): no horizontal scrolling at 360 and 320 px,
 * every target at least 24 px (or spaced), focus never hidden behind the
 * header or the app bar at the page's width and at 360, and its primary
 * controls at least 44 px at 360. prod/sweeps.spec.ts and
 * stub/sweeps.spec.ts run the rows of their phase; a page that needs stub
 * sign-in or the styleguide is a stub row.
 */

type JourneyPage = {
  readonly name: string;
  readonly phase: Phase;
  /** Opens the page, signed in where it needs to be, ready for JS input. */
  readonly open: (page: Page) => Promise<void>;
  /**
   * The page's primary controls besides the shell's (its home link and the
   * app bar cells), which every page inside the shell has.
   */
  readonly primary: (page: Page) => readonly Locator[];
  /** Pages under the root error boundary have no shell. */
  readonly inShell: boolean;
  /** A long page whose Tab walk alone takes most of the default timeout. */
  readonly long?: boolean;
};

const MOBILE = { width: 360, height: 800 };

/** Opens `path` and waits for the shell to hydrate. */
function visit(path: string, status = 200) {
  return async (page: Page) => {
    const response = await page.goto(path);
    expect(response?.status(), `GET ${path}`).toBe(status);
    await waitForHydration(page);
  };
}

const main = (page: Page) => page.getByRole("main");

/**
 * React Router's `.data` body for the help route's loader throwing
 * `new Error()`, as `encodeViaTurboStream` writes it in production mode
 * (the message replaced, the stack dropped):
 * `{ "routes/help.$slug": { error } }`.
 */
const HELP_LOADER_THREW =
  '[{"_1":2},"routes/help.$slug",{"_3":4},"error",["SanitizedError",5,6,-7],"Error","Unexpected Server Error"]\n';

/**
 * The root error boundary's standalone page (DESIGN §10.5), from the
 * production bundle. No URL reaches it on purpose (every loader fails
 * soft or into a route boundary), so a client navigation's single fetch
 * (the footer's link to a help page, whose loader reads its content) is
 * answered the way React Router answers a loader that threw in
 * production: 500, and the route's error as a sanitised Error in
 * turbo-stream. The route is the page's own, so it overrides the network
 * guard's only for that request.
 */
export async function openServerError(page: Page): Promise<void> {
  await visit("/")(page);
  await page.route(
    url => url.pathname === "/help/licence.data",
    route =>
      route.fulfill({
        status: 500,
        headers: { "X-Remix-Response": "yes" },
        contentType: "text/x-script",
        body: HELP_LOADER_THREW,
      })
  );
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Licence & attribution" })
    .click();
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Something went wrong" })
  ).toBeVisible();
}

const HELP_PAGES = [
  "/help",
  "/help/contributing",
  "/help/faq-for-bards",
  "/help/bard-preference-checklist",
  "/help/conservation-status",
  "/help/licence",
];

const JOURNEY_PAGES: readonly JourneyPage[] = [
  {
    name: "home",
    phase: "prod",
    open: visit("/"),
    primary: page => [
      // The hero's call to action; a card further down repeats it.
      main(page).getByRole("link", { name: "How to contribute" }).first(),
      main(page).getByRole("link", {
        name: "Browse on the original wiki (opens original wiki)",
      }),
      main(page).getByRole("searchbox", { name: "Search the original wiki" }),
    ],
    inShell: true,
  },
  ...HELP_PAGES.map(path => ({
    name: path,
    phase: "prod" as const,
    open: visit(path),
    primary: () => [],
    inShell: true,
  })),
  {
    name: "/pieces?letter=T",
    phase: "prod",
    open: visit("/pieces?letter=T"),
    primary: page => [
      main(page).getByRole("searchbox", { name: "Search pieces" }),
    ],
    inShell: true,
  },
  {
    name: "/pieces",
    phase: "prod",
    open: visit("/pieces"),
    primary: page => [
      main(page).getByRole("searchbox", { name: "Search pieces" }),
      main(page)
        .getByRole("navigation", { name: "Pagination" })
        .getByRole("link", { name: "Next" }),
    ],
    inShell: true,
    // 50 rows, the A–Z and the pages: a long Tab walk.
    long: true,
  },
  {
    name: "resting (503)",
    phase: "prod",
    open: async page => {
      const q = `resting-sweep-${test.info().workerIndex}-${Date.now()}`;
      await outageNext(page.request, {
        operationId: "listPieces",
        match: { q },
        mode: "503",
      });
      await visit(`/pieces?q=${q}`, 503)(page);
    },
    primary: page => [
      main(page).getByRole("button", { name: "Try again" }),
      main(page).getByRole("link", { name: "Go to the home page" }),
    ],
    inShell: true,
  },
  // Track B (C4, C5): the piece and bard pages.
  {
    name: "/pieces/the-copper-kettle",
    phase: "prod",
    open: visit("/pieces/the-copper-kettle"),
    primary: () => [],
    inShell: true,
  },
  {
    name: "/pieces/the-dragons-hoard (restricted)",
    phase: "prod",
    open: visit("/pieces/the-dragons-hoard"),
    primary: () => [],
    inShell: true,
  },
  {
    name: "/bards/wren-of-the-vale",
    phase: "prod",
    open: visit("/bards/wren-of-the-vale"),
    primary: () => [],
    inShell: true,
  },
  {
    name: "/bards/hollis-fenn (no page)",
    phase: "prod",
    open: visit("/bards/hollis-fenn"),
    primary: () => [],
    inShell: true,
  },
  {
    name: "/bards?letter=W",
    phase: "prod",
    open: visit("/bards?letter=W"),
    primary: page => [
      main(page).getByRole("searchbox", { name: "Search bards" }),
    ],
    inShell: true,
  },
  {
    name: "settings, signed out",
    phase: "prod",
    open: visit("/settings"),
    primary: page => [main(page).getByRole("link", { name: "Log in" })],
    inShell: true,
  },
  {
    name: "404",
    phase: "prod",
    open: visit("/wiki/Ballad_of_the_Bell", 404),
    primary: page => [
      main(page).getByRole("link", { name: "Go to the home page" }),
    ],
    inShell: true,
  },
  {
    name: "server error (root boundary)",
    phase: "prod",
    open: openServerError,
    primary: page => [
      page.getByRole("banner").getByRole("link", { name: "Bardic Torch" }),
      main(page).getByRole("button", { name: "Try again" }),
      main(page).getByRole("link", { name: "Go to the home page" }),
    ],
    inShell: false,
  },
  {
    name: "settings, signed in",
    phase: "stub",
    open: async page => {
      const id = await createFixtureUser(page.request);
      await page.goto(`/auth/login?as=${id}&returnTo=/settings`);
      await expect(page).toHaveURL(/\/settings$/);
      await waitForHydration(page);
      await expect(
        main(page).getByRole("heading", { level: 2, name: "API tokens" })
      ).toBeVisible();
    },
    primary: page => [
      main(page).getByRole("button", { name: "Save changes" }),
      main(page).getByRole("button", { name: "Create token" }),
    ],
    inShell: true,
  },
  {
    name: "styleguide",
    phase: "stub",
    open: async page => {
      await visit("/styleguide")(page);
      await expect(
        page.getByRole("tablist", { name: "Preview" })
      ).toBeVisible();
    },
    primary: () => [],
    inShell: true,
    long: true,
  },
];

/** The shell's own primary controls below md: home, then the app bar. */
function shellPrimary(page: Page): Locator[] {
  const bar = appBar(page);
  return [
    page.getByRole("banner").getByRole("link", { name: "Bardic Torch" }),
    bar.getByRole("button", { name: "Menu" }),
    bar.getByRole("button", { name: "Search", exact: true }),
    bar.getByRole("link", { name: "Log in" }).or(accountTrigger(bar)),
  ];
}

/** Registers one sweep test per journey page of `phase`. */
export function sweepJourneyPages(phase: Phase): void {
  for (const journey of JOURNEY_PAGES.filter(row => row.phase === phase)) {
    test(`${journey.name}: reflows, its targets are big enough and focus is never hidden`, async ({
      page,
    }) => {
      if (journey.long) test.slow();
      await journey.open(page);
      await expectNoHorizontalOverflow(page);
      await expectTargetSizesAtLeast24(page);
      await expectFocusNotObscured(page);
      await page.setViewportSize(MOBILE);
      await expectPrimaryTargetsAtLeast44([
        ...(journey.inShell ? shellPrimary(page) : []),
        ...journey.primary(page),
      ]);
    });
  }
}
