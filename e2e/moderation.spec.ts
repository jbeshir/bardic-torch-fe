import { expect } from "@playwright/test";
import { waitForHydration } from "./support/hydration";
import { test } from "./support/test";

/**
 * The moderation journeys (plan §9): moderating revisions (one stale,
 * approved after the warning; one rejected with a note), and the contact
 * form (reporting a link, then the inbox and taking the link down). Each
 * run makes its own revisions and requests, so a retry starts afresh.
 */

const signIn = (as: "contributor" | "moderator", returnTo: string) =>
  `/auth/login?as=${as}&returnTo=${encodeURIComponent(returnTo)}`;

test("moderating: a stale edit approved after the warning, another rejected", async ({
  page,
}) => {
  // Five editor pages and their posts: slow when every worker is busy.
  test.slow();
  const run = Date.now();
  const main = page.getByRole("main");
  const submit = async (path: string, summary: string, button: string) => {
    await page.goto(path);
    await main.getByLabel("Summary of your changes").fill(summary);
    await main.getByRole("button", { name: button }).click();
  };

  // A contributor sends two edits.
  await page.goto(signIn("contributor", "/contributions"));
  const stale = `Journey wassail edit ${run}`;
  const rejected = `Journey revel edit ${run}`;
  await submit("/pieces/the-ashdown-wassail/edit", stale, "Submit for review");
  await expect(page).toHaveURL(/\/contributions\?submitted=\d+$/);
  await submit("/events/midwinter-revel/edit", rejected, "Submit for review");
  await expect(page).toHaveURL(/\/contributions\?submitted=\d+$/);

  // A moderator's own edit of the piece goes live, so the first is stale.
  await page.goto(signIn("moderator", "/moderation"));
  await submit(
    "/pieces/the-ashdown-wassail/edit",
    `Journey tidy-up ${run}`,
    "Save"
  );
  await expect(page).toHaveURL(/\/pieces\/the-ashdown-wassail$/);

  await page.goto("/moderation");
  await main
    .getByRole("row", { name: new RegExp(stale) })
    .getByRole("link", { name: /^Review/ })
    .click();
  await expect(
    main.getByText("This piece has changed since this edit was started.")
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Compared with the current version" })
  ).toBeVisible();

  await main.getByRole("button", { name: "Approve" }).click();
  await expect(main.getByText("Approve it anyway")).toBeVisible();
  await main.getByLabel(/^Approve anyway/).check();
  await main.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/moderation\?approved=\d+$/);
  await expect(main.getByText(/Revision \d+ is approved\./)).toBeVisible();

  await main
    .getByRole("row", { name: new RegExp(rejected) })
    .getByRole("link", { name: /^Review/ })
    .click();
  await main
    .getByLabel("Note to the author")
    .fill("Please say where the feast is described.");
  await main.getByRole("button", { name: "Reject" }).click();
  await expect(page).toHaveURL(/\/moderation\?rejected=\d+$/);
  await expect(main.getByText(/Revision \d+ is rejected\./)).toBeVisible();
  await expect(
    main.getByRole("row", { name: new RegExp(rejected) })
  ).toHaveCount(0);
});

test("contact: report a link, then resolve it and take the link down", async ({
  page,
}) => {
  const message = `Journey report ${Date.now()}: the description has lyrics.`;
  const main = page.getByRole("main");

  await page.goto("/pieces/the-copper-kettle");
  await main
    .getByRole("link", { name: /^Report this link/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/contact\?kind=link_report&url=/);
  await waitForHydration(page);
  await expect(main.getByLabel("What it’s about")).toHaveValue("link_report");
  await main.getByLabel("Your email address").fill("reader@example.org");
  await main.getByLabel("Message").fill(message);
  await main.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/contact\?sent=1$/);
  await expect(
    main.getByText("Thank you. Your message is with the moderators.")
  ).toBeVisible();

  await page.goto(signIn("moderator", "/moderation/contact"));
  const request = main.getByRole("article").filter({ hasText: message });
  await request
    .getByRole("link", { name: "Find this link to take it down" })
    .click();
  await expect(main.getByText("Shown on the site")).toBeVisible();
  await main.getByRole("button", { name: "Hide the link everywhere" }).click();
  await expect(main.getByText("The link is hidden everywhere.")).toBeVisible();
  await expect(main.getByText("Hidden from the site")).toBeVisible();
  // Shown again, for the other journeys.
  await main.getByRole("button", { name: "Restore the link" }).click();
  await expect(main.getByText("Shown on the site")).toBeVisible();

  await page.goto("/moderation/contact");
  await request.getByLabel("Note").fill("Hidden, then restored: no lyrics.");
  await request.getByRole("button", { name: "Resolve" }).click();
  await expect(main.getByText("The request is closed.")).toBeVisible();
  await expect(request).toHaveCount(0);
});
