import { expect, type Locator, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

/** Layout and WCAG 2.2 checks for journeys to run on their pages. */

const REFLOW_WIDTHS = [360, 320];
/** A walk that has not come back to its first stop by then fails. */
const MAX_TABS = 400;
/** Below md: the width with the fixed bottom app bar. */
const FOCUS_WIDTH = 360;

/** What the sweeps (and the styleguide focus states) count as a control. */
export const FOCUSABLE =
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

/** Widths the 2.5.8 sweep runs at: below md (app bar) and the desktop shell. */
const TARGET_WIDTHS: readonly number[] = [360, 1280];

/**
 * WCAG 2.5.8 at 360 and 1280 px (the header's md+ controls are only there):
 * every visible focusable is at least 24×24, or the 24 px circle on its
 * centre intersects no other target and no other undersized target's
 * circle (centres at least 24 px apart). The inline exception covers only
 * a target in a sentence: an inline link whose block also has text of its
 * own. A link alone in a list item, cell or paragraph is checked.
 *
 * With a modal dialog open only its contents are targets (the page behind
 * it is inert). Open states call it too (drawer, panels, dialogs, the
 * token reveal), passing just the widths at which that state exists: a
 * drawer closes itself at lg, and each width has its own account panel.
 */
export async function expectTargetSizesAtLeast24(
  page: Page,
  widths: readonly number[] = TARGET_WIDTHS
): Promise<void> {
  for (const width of widths) {
    const failures = await withWidth(page, width, () =>
      page.evaluate(findSmallTargets, FOCUSABLE)
    );
    expect(
      failures,
      `targets smaller than 24×24 without spacing at ${width}px`
    ).toEqual([]);
  }
}

/** Runs in the page (self-contained): the 2.5.8 failures under the page. */
function findSmallTargets(selector: string): string[] {
  const MIN = 24;
  const modal = document.querySelector("dialog[open]:modal");
  const root = modal ?? document;

  const isInline = (element: Element) =>
    getComputedStyle(element).display === "inline";

  /** In a sentence: its nearest non-inline ancestor has text besides it. */
  const inSentence = (element: HTMLElement) => {
    if (!isInline(element)) return false;
    let block = element.parentElement;
    while (block && isInline(block)) block = block.parentElement;
    if (!block) return false;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!element.contains(node) && (node.textContent ?? "").trim() !== "") {
        return true;
      }
    }
    return false;
  };

  const name = (element: HTMLElement) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    const byIds = labelledBy
      ?.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    const label =
      element.getAttribute("aria-label") ??
      (byIds || null) ??
      (element instanceof HTMLInputElement && element.labels?.length
        ? [...element.labels].map(each => each.textContent).join(" ")
        : null) ??
      element.textContent ??
      "";
    const type =
      element instanceof HTMLInputElement ? `[type=${element.type}]` : "";
    return `${element.tagName.toLowerCase()}${type} "${label.trim().replace(/\s+/g, " ").slice(0, 40)}"`;
  };

  const targets = [...root.querySelectorAll<HTMLElement>(selector)]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        !element.closest("[inert]") &&
        !inSentence(element)
      );
    })
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        layer: layerOf(element),
        rect,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        small: rect.width < MIN || rect.height < MIN,
      };
    });

  /**
   * The fixed or sticky box a target rides in (the header, the app bar, a
   * toast), or null for the page. Spacing is between targets of one layer:
   * a link that has scrolled under the app bar isn't "next to" its cells
   * (whether focus is hidden there is expectFocusNotObscured's question).
   */
  function layerOf(element: HTMLElement): Element | null {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const { position } = getComputedStyle(node);
      if (position === "fixed" || position === "sticky") return node;
    }
    return null;
  }

  const related = (a: HTMLElement, b: HTMLElement) =>
    a === b || a.contains(b) || b.contains(a);
  const circleHitsRect = (x: number, y: number, rect: DOMRect) => {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return dx * dx + dy * dy < (MIN / 2) ** 2;
  };

  return targets.flatMap(target => {
    if (!target.small) return [];
    const crowding = targets.find(
      other =>
        other.layer === target.layer &&
        !related(other.element, target.element) &&
        (circleHitsRect(target.x, target.y, other.rect) ||
          (other.small &&
            Math.hypot(other.x - target.x, other.y - target.y) < MIN))
    );
    return crowding
      ? [
          `${name(target.element)} is ${Math.round(target.rect.width)}×${Math.round(target.rect.height)} and too close to ${name(crowding.element)}`,
        ]
      : [];
  });
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
  let wrapped = false;

  for (let tab = 0; tab < MAX_TABS && !wrapped; tab += 1) {
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
        label: `${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40)}"`,
        visible,
      };
    });

    if (result === null || result.key === first) {
      wrapped = true;
    } else {
      first ??= result.key;
      if (!result.visible)
        problems.push(`${result.label} is obscured when focused`);
    }
  }
  // Stops past the limit would go unchecked: say so rather than pass.
  if (!wrapped) problems.push(`the Tab walk did not wrap in ${MAX_TABS} stops`);
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
