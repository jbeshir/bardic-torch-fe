import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Locators for the shell's controls. Several exist twice in the DOM: the
 * header's (from md) and the bottom app bar's (below md), and below lg
 * without JS the site menu after the content has its own search and theme
 * toggle. CSS shows one copy per width and the others are `display: none`,
 * so role queries already see only the visible one; these helpers keep
 * text and `summary` queries (which don't filter by visibility) just as
 * precise.
 */

/** The bottom app bar (below md; nothing from md, where it is display: none). */
export function appBar(page: Page): Locator {
  return page.getByRole("banner").getByRole("group", { name: "App bar" });
}

/**
 * The account disclosure's `<summary>` inside `scope` that is showing at
 * this width (the banner holds the header's and the bar's).
 */
export function accountTrigger(scope: Locator): Locator {
  return scope.locator("summary").filter({ visible: true });
}

/** The panel `trigger` discloses, found through its `aria-controls`. */
export async function accountPanel(trigger: Locator): Promise<Locator> {
  const id = await trigger.getAttribute("aria-controls");
  if (!id) throw new Error("the account trigger has no aria-controls");
  return trigger.page().locator(`[id="${id}"]`);
}

/**
 * Opens the account panel of the trigger showing at this width, unless it
 * is open already: a checkpoint's `atEachViewport` for the account states,
 * whose header and app bar copies are separate disclosures.
 */
export async function openShownAccountPanel(page: Page): Promise<void> {
  const trigger = accountTrigger(page.getByRole("banner"));
  const panel = await accountPanel(trigger);
  if (!(await panel.isVisible())) await trigger.click();
  await expect(panel).toBeVisible();
}
