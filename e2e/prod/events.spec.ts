import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  expectNoHorizontalOverflow,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { test } from "../support/test";

/**
 * `/events` and an event's or venue's page (plan §4.10) against the
 * fixture catalogue: 8 events and venues, Midwinter Revel (3 performances,
 * one of the restricted piece) and Muster Field (203, capped at 200).
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: the directory, every event and venue by name", async ({
  page,
}) => {
  await open(page, "/events");
  await expect(page).toHaveTitle("Events and venues · Bardic Torch");
  await expect(main(page)).toContainText("8 events and venues");
  await checkpoint(page, "directory");
});

test("the kind switch shows one kind, and a messy kind is made canonical", async ({
  page,
}) => {
  await open(page, "/events");
  const kinds = main(page).getByRole("navigation", { name: "Kinds" });
  await kinds.getByRole("link", { name: "Venues" }).click();
  await expect(page).toHaveURL(/\/events\?kind=venue$/);
  await expect(kinds.getByRole("link", { name: "Venues" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    main(page).getByRole("link", { name: "Midwinter Revel" })
  ).toHaveCount(0);
  await page.goto("/events?kind=Venue");
  await expect(page).toHaveURL(/\/events\?kind=venue$/);
  await page.goto("/events?kind=tavern");
  await expect(page).toHaveURL(/\/events$/);
});

test("checkpoint: event, its performances newest first", async ({ page }) => {
  await open(page, "/events");
  await main(page).getByRole("link", { name: "Midwinter Revel" }).click();
  await expect(page).toHaveURL(/\/events\/midwinter-revel$/);
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Midwinter Revel" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("region", { name: "Performances recorded here" })
  ).toContainText("Midwinter Carol");
  await checkpoint(page, "event");
});

test("a restricted piece's performance names it but links nowhere outside", async ({
  page,
}) => {
  for (const path of ["/events/muster-field", "/events/midwinter-revel"]) {
    await open(page, path);
    await expect(
      main(page).getByRole("link", { name: "The Dragon’s Hoard" }).first()
    ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
    await expect(
      page.locator('a[href*="private-recordings.example"]')
    ).toHaveCount(0);
    expect(await page.content()).not.toContain("private-recordings.example");
  }
});

test("a venue with more than 200 performances says how many more", async ({
  page,
}) => {
  await open(page, "/events/muster-field");
  await expect(main(page).getByText("and 3 more")).toBeVisible();
  // 200 rows are too many for the Tab-walk sweep: check their layout here.
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
});
