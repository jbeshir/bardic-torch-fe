import { expect, type Locator, type Page } from "@playwright/test";

/** Layout and WCAG 2.2 checks for journeys to run on their pages. */

const REFLOW_WIDTHS = [360, 320];
const MAX_TABS = 200;

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, ' +
  '[tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

async function withWidth<T>(
  page: Page,
  width: number,
  check: () => Promise<T>
): Promise<T> {
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: original?.height ?? 800 });
  try {
    return await check();
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

/**
 * Waits for the element's animations (e.g. a drawer sliding in) to finish,
 * so its box is final.
 */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(element =>
    Promise.all(
      element.getAnimations({ subtree: true }).map(({ finished }) => finished)
    )
  );
}

/** No horizontal scrolling at 360 px or at 320 px (WCAG 1.4.10 reflow). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  for (const width of REFLOW_WIDTHS) {
    const overflow = await withWidth(page, width, () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
      0
    );
  }
}

/**
 * WCAG 2.5.8 at 360 px: every visible focusable outside running text is at
 * least 24×24, or a 24 px circle on its centre touches no other target.
 * Inline links inside paragraphs, list items and table cells are exempt.
 */
export async function expectTargetSizesAtLeast24(page: Page): Promise<void> {
  const failures = await withWidth(page, 360, () =>
    page.evaluate(selector => {
      const MIN = 24;
      const RUNNING_TEXT = "p, li, dd, dt, td, th, blockquote, figcaption";
      const targets = [...document.querySelectorAll<HTMLElement>(selector)]
        .filter(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            !(style.display === "inline" && element.closest(RUNNING_TEXT))
          );
        })
        .map(element => ({ element, rect: element.getBoundingClientRect() }));

      const describe = (element: HTMLElement) =>
        `${element.tagName.toLowerCase()} "${(element.textContent ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 40)}"`;

      const circleHits = (
        x: number,
        y: number,
        rect: DOMRect,
        radius: number
      ) => {
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const dy = Math.max(rect.top - y, 0, y - rect.bottom);
        return dx * dx + dy * dy < radius * radius;
      };

      return targets.flatMap(({ element, rect }) => {
        if (rect.width >= MIN && rect.height >= MIN) return [];
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const crowded = targets.some(
          other =>
            other.element !== element &&
            !other.element.contains(element) &&
            !element.contains(other.element) &&
            circleHits(x, y, other.rect, MIN / 2)
        );
        return crowded
          ? [
              `${describe(element)} is ${Math.round(rect.width)}×${Math.round(rect.height)} and too close to another target`,
            ]
          : [];
      });
    }, FOCUSABLE)
  );
  expect(failures, "targets smaller than 24×24 without spacing").toEqual([]);
}

/**
 * Tab through the page; each focused element must be at least partly
 * visible, not hidden behind sticky or overlaid content (WCAG 2.4.11).
 */
export async function expectFocusNotObscured(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const problems: string[] = [];
  let first: string | null = null;

  for (let tab = 0; tab < MAX_TABS; tab += 1) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const inset = Math.min(2, rect.width / 2, rect.height / 2);
      const points: [number, number][] = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + inset, rect.top + inset],
        [rect.right - inset, rect.top + inset],
        [rect.left + inset, rect.bottom - inset],
        [rect.right - inset, rect.bottom - inset],
      ];
      const visible = points.some(([x, y]) => {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
          return false;
        }
        const hit = document.elementFromPoint(x, y);
        return hit !== null && (element === hit || element.contains(hit));
      });
      const path = [];
      for (
        let node: Element | null = element;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const index = node.parentElement
          ? [...node.parentElement.children].indexOf(node)
          : 0;
        path.unshift(`${node.tagName.toLowerCase()}:${index}`);
      }
      return {
        key: path.join(">"),
        label: `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 40)}"`,
        visible,
      };
    });

    if (result === null || result.key === first) break;
    first ??= result.key;
    if (!result.visible)
      problems.push(`${result.label} is obscured when focused`);
  }
  expect(problems, "focus obscured").toEqual([]);
}

/**
 * Primary controls are at least 44 × 44 px (DESIGN principle 7, WCAG 2.5.5
 * as the design's own bar): each of `controls` must be visible and that big
 * at the current viewport.
 */
export async function expectPrimaryTargetsAtLeast44(
  controls: readonly Locator[]
): Promise<void> {
  const MIN = 44;
  const failures: string[] = [];
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    const width = Math.round(box?.width ?? 0);
    const height = Math.round(box?.height ?? 0);
    if (width < MIN || height < MIN) {
      failures.push(`${control.toString()} is ${width}×${height}`);
    }
  }
  expect(failures, "primary controls smaller than 44×44").toEqual([]);
}
