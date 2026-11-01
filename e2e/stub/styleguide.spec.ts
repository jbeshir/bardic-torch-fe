import { expect, type Locator, type Page } from "@playwright/test";
import { channelString, resolveColour } from "../../app/styles/tokens";
import { ACCOUNT_MENU_OPEN, STYLEGUIDE_BLOCKS } from "../support/checkpoints";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  expectNoHorizontalOverflow,
  expectTargetSizesAtLeast24,
  FOCUSABLE,
  settled,
} from "../support/layout";
import { accountPanel } from "../support/shell";
import { applyTextSpacing, expectNothingCutOff } from "../support/text-spacing";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

/**
 * The styleguide (DESIGN §10.6, R21, R22): every block in both themes at
 * every viewport (axe + screenshots), the modal Dialog and Drawer with
 * their real focus trap, toasts, the forced-theme preview, Windows forced
 * colours and the WCAG 1.4.12 text-spacing override. It exists in the e2e
 * build only; prod/errors.spec.ts checks it is a 404 in production.
 */

/**
 * Opens the styleguide and waits for hydration. The Preview tablist only
 * exists with JS (without it the Current panel is shown under its heading).
 */
async function openStyleguide(page: Page, hash = ""): Promise<void> {
  const response = await page.goto(`/styleguide${hash}`);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);
  await expect(page.getByRole("tablist", { name: "Preview" })).toBeVisible();
}

/** How long a success toast stays (AUTO_DISMISS_MS in ui/Toast.tsx). */
const TOAST_AUTO_DISMISS_MS = 6000;
/** How long the styleguide's demo revoke stays pending (Overlays.tsx). */
const DEMO_PENDING_MS = 2000;
/** The page clock's start, and where it is held (well past hydration). */
const CLOCK_START = Date.UTC(2026, 0, 1);
const CLOCK_PAUSE_OFFSET_MS = 60 * 60 * 1000;

function block(page: Page, id: string): Locator {
  return page.locator(`section#${id}`);
}

/** The accessible label of whatever has focus, and whether it is in `selector`. */
async function focused(page: Page, selector: string) {
  return page.evaluate(container => {
    const active = document.activeElement;
    return {
      inside: Boolean(
        active && document.querySelector(container)?.contains(active)
      ),
      label:
        active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "",
    };
  }, selector);
}

/** Tab (or Shift+Tab) `count` times, returning each focused control's label. */
async function tabThrough(
  page: Page,
  selector: string,
  count: number,
  key: "Tab" | "Shift+Tab" = "Tab"
): Promise<string[]> {
  const labels: string[] = [];
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press(key);
    const { inside, label } = await focused(page, selector);
    expect(inside, `focus left ${selector} after ${key} ×${step + 1}`).toBe(
      true
    );
    labels.push(label);
  }
  return labels;
}

/** Whether a click at the element's centre would reach it (not inert). */
async function reachable(locator: Locator): Promise<boolean> {
  return locator.evaluate(element => {
    const { left, top, width, height } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(left + width / 2, top + height / 2);
    return hit !== null && (hit === element || element.contains(hit));
  });
}

test("renders every block in the order the checkpoints declare, and isn't indexed", async ({
  page,
}) => {
  await openStyleguide(page);
  await expect(page).toHaveTitle("Styleguide · Bardic Torch");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow"
  );
  const ids = await page
    .getByRole("tabpanel", { name: "Current" })
    .locator("section[data-specimen]")
    .evaluateAll(sections => sections.map(section => section.id));
  expect(ids).toEqual([...STYLEGUIDE_BLOCKS]);
});

/**
 * Keyboard focus on `control`, so a checkpoint records its real focus ring
 * (DESIGN §10.6): after a key press, programmatic focus counts as keyboard
 * focus (`:focus-visible`), as it would after a Tab.
 */
async function showFocusRing(page: Page, control: Locator): Promise<void> {
  await page.keyboard.press("Shift");
  await control.focus();
  await expect(control).toBeFocused();
  expect(
    await control.evaluate(element => element.matches(":focus-visible")),
    "focus shows its ring"
  ).toBe(true);
}

/** The block's first control a reader can reach: its checkpoint shows it focused. */
function firstControl(page: Page, id: string): Locator {
  return block(page, id)
    .locator(`:is(${FOCUSABLE}):not(:disabled)`)
    .filter({ visible: true })
    .first();
}

/**
 * The state each block's checkpoint is taken in, beyond rest: the first
 * control focused by keyboard (every block with one), the error summary
 * after a keyboard submit (its focused danger summary), and the toast
 * block with one toast of each tone held on screen by focus on the first
 * one's dismiss button, captured as the viewport so their placement shows. Hover can't be held for a static
 * capture and isn't recorded (DESIGN §10.6).
 */
const BLOCK_STATES: Partial<
  Record<(typeof STYLEGUIDE_BLOCKS)[number], (page: Page) => Promise<void>>
> = {
  "error-summary": async page => {
    const submit = block(page, "error-summary").getByRole("button", {
      name: "Check the form",
    });
    await showFocusRing(page, submit);
    await page.keyboard.press("Enter");
    const summary = block(page, "error-summary").getByRole("alert");
    await expect(summary).toContainText("Check 2 things below");
    await expect(summary.getByRole("link")).toHaveCount(2);
    await expect(summary).toBeFocused();
    expect(
      await summary.evaluate(element => element.matches(":focus-visible"))
    ).toBe(true);
  },
  toast: async page => {
    for (const name of [
      "Show a success toast",
      "Show an info toast",
      "Show an error toast",
    ]) {
      const trigger = block(page, "toast").getByRole("button", { name });
      await showFocusRing(page, trigger);
      await page.keyboard.press("Enter");
    }
    const region = page.getByRole("region", { name: "Notifications" });
    await expect(region.getByRole("status")).toContainText(
      "Display name saved."
    );
    await expect(region.getByRole("status")).toContainText(
      "Copied the token to the clipboard."
    );
    await expect(region.getByRole("alert")).toContainText("offline");
    // Focus in the stack holds every toast (Toast.tsx) through the capture,
    // without holding the page clock (axe runs on timers), and shows the
    // dismiss button's ring.
    await showFocusRing(
      page,
      region.getByRole("button", { name: "Dismiss notification" }).first()
    );
  },
};

for (const id of STYLEGUIDE_BLOCKS) {
  test(`checkpoint: ${id}`, async ({ page }) => {
    await openStyleguide(page);
    const state = BLOCK_STATES[id];
    if (state) {
      await state(page);
    }
    // The first control is looked up again at each width: the one at one
    // width can be hidden at another (pagination's page numbers below sm),
    // and focus is lost with it.
    const focusFirst =
      !state && (await firstControl(page, id).count()) > 0
        ? (each: Page) => showFocusRing(each, firstControl(each, id))
        : undefined;
    await checkpoint(
      page,
      id,
      id === "toast"
        ? {
            target: 'section[aria-label="Notifications"]',
            viewportOnly: true,
            atEachViewport: async each => {
              await block(each, "toast").scrollIntoViewIfNeeded();
            },
          }
        : { target: `section#${id}`, atEachViewport: focusFirst }
    );
  });
}

for (const { checkpoint: name, example } of ACCOUNT_MENU_OPEN) {
  test(`checkpoint: ${name}`, async ({ page }) => {
    await openStyleguide(page);
    const figure = block(page, "account-menu")
      .locator("figure")
      .filter({ has: page.getByText(example, { exact: true }) });
    const trigger = figure.locator("summary");
    const open = async (each: Page) => {
      const panel = await accountPanel(trigger);
      if (!(await panel.isVisible())) {
        await showFocusRing(each, trigger);
        await each.keyboard.press("Enter");
      }
      await expect(panel).toBeVisible();
      await trigger.evaluate(element =>
        element.scrollIntoView({ block: "center" })
      );
      await expect(trigger).toBeFocused();
    };
    await open(page);
    await checkpoint(page, name, {
      target: "section#account-menu",
      viewportOnly: true,
      atEachViewport: open,
    });
  });
}

test("the preview forces a theme on its panel, whatever the device prefers", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openStyleguide(page);
  const tabs = page.getByRole("tablist", { name: "Preview" });
  await tabs.getByRole("tab", { name: "Light" }).click();
  const light = page.locator('[data-preview="light"]');
  await expect(light).toBeVisible();
  expect(
    await light.evaluate(element =>
      getComputedStyle(element).getPropertyValue("--canvas").trim()
    )
  ).toBe(channelString(resolveColour("light", "canvas")));

  await page.emulateMedia({ colorScheme: "light" });
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Dark" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  const dark = page.locator('[data-preview="dark"]');
  await expect(dark).toBeVisible();
  expect(
    await dark.evaluate(element =>
      getComputedStyle(element).getPropertyValue("--canvas").trim()
    )
  ).toBe(channelString(resolveColour("dark", "canvas")));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("End");
  const both = page.getByRole("tabpanel", { name: "Side by side" });
  const [left, right] = await both
    .locator("[data-preview]")
    .evaluateAll(panels =>
      panels.map(panel => panel.getBoundingClientRect().top)
    );
  expect(left).toBe(right);
});

test.describe("Dialog", () => {
  test("a destructive confirm traps focus, starts on Cancel and returns focus", async ({
    page,
  }) => {
    await openStyleguide(page, "#dialog");
    const trigger = block(page, "dialog").getByRole("button", {
      name: "Revoke",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "Anything using ‘Laptop MCP’ will stop working straight away. This can’t be undone."
    );
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    // The page behind is inert: a click there lands on the dialog's backdrop.
    expect(await reachable(trigger)).toBe(false);

    const forwards = await tabThrough(page, "dialog[open]", 6);
    expect(forwards).toEqual([
      "Revoke token",
      "Close",
      "Cancel",
      "Revoke token",
      "Close",
      "Cancel",
    ]);
    const backwards = await tabThrough(page, "dialog[open]", 3, "Shift+Tab");
    expect(backwards).toEqual(["Close", "Revoke token", "Cancel"]);

    // Destructive: the backdrop doesn't close it.
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).not.toHaveClass(/overflow-hidden/);
  });

  test("while the revoke is pending, Escape is ignored; then it closes with a toast", async ({
    page,
  }) => {
    // The demo's revoke is pending for 2 s of page time (Overlays.tsx); under
    // load one click can take longer than that, so the page's clock is held
    // while the pending state is checked, then moved on by exactly 2 s.
    await page.clock.install({ time: CLOCK_START });
    await openStyleguide(page, "#dialog");
    const trigger = block(page, "dialog").getByRole("button", {
      name: "Revoke",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
    await expect(dialog).toBeVisible();
    await page.clock.pauseAt(CLOCK_START + CLOCK_PAUSE_OFFSET_MS);
    const confirm = dialog.getByRole("button", { name: "Revoke token" });
    await confirm.click();
    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await page.clock.runFor(DEMO_PENDING_MS);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole("region", { name: "Notifications" }).getByRole("status")
    ).toContainText("Token revoked.");
  });

  test("a form dialog starts on its field and closes from the backdrop", async ({
    page,
  }) => {
    await openStyleguide(page, "#dialog");
    const trigger = block(page, "dialog").getByRole("button", {
      name: "Rename",
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Rename token" });
    await expect(
      dialog.getByRole("textbox", { name: /Token name/ })
    ).toBeFocused();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("textbox", { name: /Token name/ }).fill("Desktop");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Notifications" }).getByRole("status")
    ).toContainText("Token renamed.");
  });

  test("below sm the buttons stack full width with Cancel at the bottom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openStyleguide(page, "#dialog");
    await block(page, "dialog")
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
    await expect(dialog).toBeVisible();
    await settled(dialog);
    const cancel = await dialog
      .getByRole("button", { name: "Cancel" })
      .boundingBox();
    const revoke = await dialog
      .getByRole("button", { name: "Revoke token" })
      .boundingBox();
    expect(cancel && revoke).toBeTruthy();
    if (!cancel || !revoke) return;
    expect(cancel.y).toBeGreaterThan(revoke.y);
    expect(cancel.width).toBeCloseTo(revoke.width, 0);
    expect(cancel.x).toBeCloseTo(revoke.x, 0);
  });

  test("checkpoint: dialog-open, opened by keyboard: Cancel shows its ring over the scrim", async ({
    page,
  }) => {
    await openStyleguide(page, "#dialog");
    await showFocusRing(
      page,
      block(page, "dialog").getByRole("button", { name: "Revoke", exact: true })
    );
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await expect(cancel).toBeFocused();
    expect(
      await cancel.evaluate(element => element.matches(":focus-visible"))
    ).toBe(true);
    await expectTargetSizesAtLeast24(page, [360, 1280]);
    // Axe on the dialog; the capture is the viewport, scrim included.
    await checkpoint(page, "dialog-open", {
      target: "dialog[open]",
      viewportOnly: true,
    });
  });
});

test.describe("Drawer", () => {
  test("below md it is a bottom sheet that traps focus and gives it back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openStyleguide(page, "#drawer");
    const trigger = block(page, "drawer").getByRole("button", {
      name: "Menu",
      exact: true,
    });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Close menu" }).first()
    ).toBeFocused();

    await settled(drawer);
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(800);
    expect(Math.round(box?.width ?? 0)).toBe(360);
    expect(box?.height ?? 0).toBeLessThanOrEqual(800 * 0.85 + 1);

    expect(await reachable(trigger)).toBe(false);
    // Close, 6 links, 3 theme buttons, bottom Close, then round again.
    const labels = await tabThrough(page, "dialog[open]", 12);
    expect(labels.slice(0, 6)).toEqual([
      "Colour",
      "Button",
      "Field and Input",
      "Tabs",
      "Alert and Banner",
      "Dialog",
    ]);
    expect(labels.slice(-3)).toEqual(["Close menu", "Close menu", "Colour"]);
    await tabThrough(page, "dialog[open]", 2, "Shift+Tab");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("from md it is the left edge, closing from the backdrop and on navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openStyleguide(page, "#drawer");
    const trigger = block(page, "drawer").getByRole("button", {
      name: "Menu",
      exact: true,
    });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await expect(drawer).toBeVisible();
    await settled(drawer);
    const box = await drawer.boundingBox();
    expect(Math.round(box?.x ?? -1)).toBe(0);
    expect(Math.round(box?.height ?? 0)).toBe(1024);
    expect(box?.width ?? 0).toBeLessThanOrEqual(320);

    await page.mouse.click(740, 500);
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await drawer.getByRole("link", { name: "Button" }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/#button$/);
  });

  test("checkpoint: drawer-open, opened by keyboard: Close shows its ring over the scrim", async ({
    page,
  }) => {
    await openStyleguide(page, "#drawer");
    await showFocusRing(
      page,
      block(page, "drawer").getByRole("button", { name: "Menu", exact: true })
    );
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await expect(drawer).toBeVisible();
    const close = drawer.getByRole("button", { name: "Close menu" }).first();
    await expect(close).toBeFocused();
    expect(
      await close.evaluate(element => element.matches(":focus-visible"))
    ).toBe(true);
    await expectTargetSizesAtLeast24(page, [360, 768]);
    await checkpoint(page, "drawer-open", {
      target: "dialog[open]",
      viewportOnly: true,
      atEachViewport: async () => {
        await expect(drawer).toBeVisible();
        await settled(drawer);
      },
    });
  });
});

test.describe("Toast", () => {
  test("appears bottom right from sm, leaves after 6 s, and never takes focus", async ({
    page,
  }) => {
    // Time flows through hydration, then holds, so the toast's 6 s are
    // counted on the page clock, not the loaded runner's.
    await page.clock.install({ time: CLOCK_START });
    await openStyleguide(page, "#toast");
    await page.clock.pauseAt(CLOCK_START + CLOCK_PAUSE_OFFSET_MS);
    const trigger = block(page, "toast").getByRole("button", {
      name: "Show a success toast",
    });
    await trigger.click();
    const region = page.getByRole("region", { name: "Notifications" });
    const toast = region.getByRole("status").getByText("Display name saved.");
    await expect(toast).toBeVisible();
    await expect(trigger).toBeFocused();
    const box = await region.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (!box || !viewport) return;
    expect(Math.round(viewport.width - (box.x + box.width))).toBe(24);
    expect(Math.round(viewport.height - (box.y + box.height))).toBe(24);
    await page.clock.runFor(TOAST_AUTO_DISMISS_MS - 1000);
    await expect(toast).toBeVisible();
    // Past the auto-dismiss and its exit fade.
    await page.clock.runFor(2000);
    await expect(toast).toBeHidden();
  });

  test("below sm sits at the top; an error stays until dismissed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.clock.install({ time: CLOCK_START });
    await openStyleguide(page, "#toast");
    await page.clock.pauseAt(CLOCK_START + CLOCK_PAUSE_OFFSET_MS);
    await block(page, "toast")
      .getByRole("button", { name: "Show an error toast" })
      .click();
    const region = page.getByRole("region", { name: "Notifications" });
    const toast = region.getByRole("alert").getByText(/You seem to be offline/);
    await expect(toast).toBeVisible();
    const box = await region.boundingBox();
    expect(box?.y ?? 999).toBeLessThan(100);
    // Well past the time a success toast leaves.
    await page.clock.runFor(TOAST_AUTO_DISMISS_MS * 2);
    await expect(toast).toBeVisible();
    await region.getByRole("button", { name: "Dismiss notification" }).click();
    // The held clock also holds the exit fade's timer.
    await page.clock.runFor(1000);
    await expect(toast).toBeHidden();
  });
});

test.describe("forced colours", () => {
  test("every control keeps an edge and every state stays visible", async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openStyleguide(page);
    expect(
      await page.evaluate(() => matchMedia("(forced-colors: active)").matches)
    ).toBe(true);
    const styleOf = (locator: Locator) =>
      locator.evaluate(element => {
        const style = getComputedStyle(element);
        return {
          border: `${style.borderTopStyle} ${style.borderTopWidth}`,
          outline: style.outlineStyle,
          appearance: style.appearance,
          display: style.display,
        };
      });

    const buttons = block(page, "button");
    for (const name of ["Save changes", "Revoke token", "Skip for now"]) {
      const { border } = await styleOf(
        buttons.getByRole("button", { name }).first()
      );
      expect(border, name).toBe("solid 1px");
    }
    const pressed = buttons.getByRole("button", { name: "Singalong only" });
    expect((await styleOf(pressed)).outline).toBe("solid");

    const lament = block(page, "checkbox").getByRole("checkbox", {
      name: "Lament",
    });
    expect((await styleOf(lament)).appearance).toBe("auto");
    const marks = lament.locator(
      "xpath=following-sibling::*[local-name()='svg']"
    );
    await expect(marks).toHaveCount(2);
    for (const mark of await marks.all()) {
      expect((await styleOf(mark)).display).toBe("none");
    }

    const current = block(page, "tabs")
      .locator('[aria-current="page"]')
      .first();
    expect((await styleOf(current)).outline).toBe("solid");
    const selected = page
      .getByRole("tablist", { name: "Preview" })
      .getByRole("tab", { selected: true });
    expect((await styleOf(selected)).outline).toBe("solid");

    const input = block(page, "input").getByRole("textbox").first();
    expect((await styleOf(input)).border).toMatch(/^solid /);

    // Focus on a pressed or selected control draws something other than
    // its state mark (WCAG 2.4.7): the mark gives way to the focus outline.
    const outlineOf = (locator: Locator) =>
      locator.evaluate(element => {
        const style = getComputedStyle(element);
        return `${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset}`;
      });
    const restingTab = await outlineOf(selected);
    await selected.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(selected).toBeFocused();
    expect(await outlineOf(selected)).not.toBe(restingTab);
    const restingPressed = await outlineOf(pressed);
    await page.keyboard.press("Shift");
    await pressed.focus();
    expect(await outlineOf(pressed)).not.toBe(restingPressed);

    // The focus ring survives too.
    await buttons.getByRole("button", { name: "Cancel" }).first().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const active = document.activeElement;
      return active ? getComputedStyle(active).outlineStyle : "";
    });
    expect(ring).toBe("solid");
  });
});

test("only Fraunces forbids faux bold: sans headings and labels may synthesise their weight", async ({
  page,
}) => {
  await openStyleguide(page);
  const synthesis = (locator: Locator) =>
    locator.evaluate(element => ({
      family: getComputedStyle(element).fontFamily,
      weight: getComputedStyle(element).getPropertyValue(
        "font-synthesis-weight"
      ),
    }));
  // A Fraunces heading: no faux bold.
  const display = await synthesis(
    page.getByRole("heading", { level: 1 }).first()
  );
  expect(display.family).toMatch(/^"?Fraunces/);
  expect(display.weight).toBe("none");
  // A heading set in the sans (the sidebar card's h3): synthesis allowed.
  const title = page
    .getByRole("heading", { name: "Keep the torch lit", includeHidden: true })
    .first();
  const sans = await synthesis(title);
  expect(sans.family).not.toMatch(/Fraunces/);
  expect(sans.weight).toBe("auto");
});

test.describe("text spacing (WCAG 1.4.12)", () => {
  // The override is an injected <style>, which the nonce CSP would block.
  test.use({ bypassCSP: true });

  test("nothing is clipped or overlaps the page edge with the spacing override", async ({
    page,
  }) => {
    await openStyleguide(page);
    await applyTextSpacing(page);
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      // Controls grow with their text instead of cutting it off.
      await expectNothingCutOff(
        page,
        '[role="tabpanel"]:not([hidden])',
        `at ${width}px`
      );
    }
    await expectNoHorizontalOverflow(page);
  });
});
