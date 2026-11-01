import { expect, type Locator, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

/** Layout and WCAG 2.2 checks for journeys to run on their pages. */

const REFLOW_WIDTHS = [360, 320];
const MAX_TABS = 200;
/** Below md: the width with the fixed bottom app bar. */
const FOCUS_WIDTH = 360;

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
 * Tabs through the page at the current width and measures each focused
 * element where focusing scrolled it to. The caller emulates reduced
 * motion, so that scroll is instant (`scroll-behavior: smooth` applies
 * only under no-preference) and the element is in its final place as soon
 * as the Tab returns: no waiting for an animation per Tab.
 */
async function focusProblems(page: Page): Promise<string[]> {
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
  return problems;
}

/**
 * Tab through the page; each focused element must be at least partly
 * visible, not hidden behind sticky or overlaid content (WCAG 2.4.11).
 * Checked at the current width and at 360 px, below md, where the bottom
 * app bar is fixed over the end of the viewport. Where focus lands does not
 * depend on how the page scrolls there, so the sweep runs under reduced
 * motion (see focusProblems) and then goes back to the device's setting.
 */
export async function expectFocusNotObscured(page: Page): Promise<void> {
  const current = page.viewportSize()?.width;
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    for (const width of new Set([current ?? FOCUS_WIDTH, FOCUS_WIDTH])) {
      const problems = await withWidth(page, width, () => focusProblems(page));
      expect(problems, `focus obscured at ${width}px`).toEqual([]);
    }
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }
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

/** The part of a `layout-shift` performance entry the CLS check reads. */
type LayoutShiftEntry = PerformanceEntry & {
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly sources?: readonly {
    readonly node: Node | null;
    readonly previousRect: DOMRectReadOnly;
    readonly currentRect: DOMRectReadOnly;
  }[];
};

/** Where the init script below keeps its observer, on `window`. */
type ShiftRecorder = {
  readonly __layoutShifts: {
    readonly observer: PerformanceObserver;
    readonly entries: LayoutShiftEntry[];
  };
};

/**
 * Cumulative layout shift is 0 while `path` loads at `viewport`
 * (DESIGN principle 6; plan §0.11): from the first paint of the server's
 * HTML, through the web font (preloaded, `font-display: optional`, with a
 * metric-matched fallback), hydration (which hides the site menu below lg
 * and folds the contents below md) and the frames after it. Every shift
 * without recent input counts, each reported with the elements it moved.
 */
export async function expectNoLayoutShift(
  page: Page,
  path: string,
  viewport: { readonly width: number; readonly height: number }
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    const entries: PerformanceEntry[] = [];
    const observer = new PerformanceObserver(list => {
      entries.push(...list.getEntries());
    });
    observer.observe({ type: "layout-shift", buffered: true });
    Object.assign(window, { __layoutShifts: { observer, entries } });
  });
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await waitForHydration(page);

  const shifts = await page.evaluate(async () => {
    // Two frames, so whatever hydration changed has been laid out, painted
    // and reported.
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const { observer, entries } = (window as unknown as ShiftRecorder)
      .__layoutShifts;
    const all = [
      ...entries,
      ...(observer.takeRecords() as LayoutShiftEntry[]),
    ] as LayoutShiftEntry[];
    const describe = (node: Node | null) => {
      if (!(node instanceof Element)) return node?.nodeName ?? "?";
      const id = node.id ? `#${node.id}` : "";
      const classes = [...node.classList].slice(0, 3).join(".");
      return `${node.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}`;
    };
    return all
      .filter(entry => !entry.hadRecentInput)
      .map(
        entry =>
          `${entry.value.toFixed(4)} at ${Math.round(entry.startTime)} ms: ` +
          (entry.sources ?? [])
            .map(
              ({ node, previousRect, currentRect }) =>
                `${describe(node)} y ${Math.round(previousRect.y)}→${Math.round(currentRect.y)}, h ${Math.round(previousRect.height)}→${Math.round(currentRect.height)}`
            )
            .join("; ")
      );
  });
  expect(shifts, `layout shifts on ${path} at ${viewport.width}px`).toEqual([]);
}
