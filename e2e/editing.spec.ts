import { expect } from "@playwright/test";
import { waitForHydration } from "./support/hydration";
import { test } from "./support/test";

/**
 * The editing journeys (plan §9): a new piece through the duplicate
 * warning, and an edit made without JavaScript (add a row, preview,
 * submit) through to the pending banner and withdrawing it.
 */

const signIn = (returnTo: string) =>
  `/auth/login?as=contributor&returnTo=${encodeURIComponent(returnTo)}`;

test("a new piece: the duplicate warning, acknowledged and resubmitted", async ({
  page,
}) => {
  await page.goto(signIn("/pieces/new"));
  await waitForHydration(page);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "New piece" })
  ).toBeVisible();
  await main.getByLabel("Title", { exact: true }).fill("the copper kettle");
  await main.getByRole("button", { name: "Submit for review" }).click();

  const warning = main.getByText("This may already be here");
  await expect(warning).toBeVisible();
  await expect(
    main.getByRole("link", { name: "The Copper Kettle" })
  ).toBeVisible();
  await main.getByLabel("Mine is not one of these").check();
  await main.getByRole("button", { name: "Submit for review" }).click();

  await expect(page).toHaveURL(/\/contributions\?submitted=\d+$/);
  await expect(
    main.getByText("Thank you. Your edit is waiting for review.")
  ).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("edit a piece: add a credit, preview, submit, the banner, withdraw", async ({
    page,
  }) => {
    await page.goto(signIn("/pieces/the-weeping-harper/edit"));
    const main = page.getByRole("main");
    const credits = main.getByRole("group", { name: /^Credit \d+$/ });
    const before = await credits.count();

    await main.getByRole("button", { name: "Add a credit" }).click();
    await expect(credits).toHaveCount(before + 1);
    const added = main.getByRole("group", { name: `Credit ${before + 1}` });
    await added
      .getByLabel("Person")
      .selectOption({ label: "Wren of the Vale" });
    await added.getByLabel("Attribution").selectOption("named");

    await main.getByRole("button", { name: "Preview" }).click();
    const preview = main.getByRole("region", { name: "Preview" });
    await expect(
      preview.getByRole("link", { name: "Wren of the Vale" }).first()
    ).toBeVisible();

    await main
      .getByLabel("Summary of your changes")
      .fill("Credit Wren for the tune");
    await main.getByRole("button", { name: "Submit for review" }).click();
    await expect(page).toHaveURL(/\/contributions\?submitted=\d+$/);

    await page.goto("/pieces/the-weeping-harper");
    await expect(
      main.getByText("You have an edit of this page waiting for review.")
    ).toBeVisible();

    await page.goto("/contributions");
    await main
      .getByRole("button", { name: /^Withdraw the edit of The Weeping Harper/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/contributions\?withdrawn=\d+$/);
    await expect(main.getByText("Your edit has been withdrawn.")).toBeVisible();
  });
});
