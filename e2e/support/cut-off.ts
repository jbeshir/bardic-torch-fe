/**
 * WCAG 1.4.12 helper, run in the page with `page.evaluate(findCutOffControls,
 * selector)`, so it must stay self-contained (no outside references).
 *
 * Every link and button under `rootSelector` must keep its visible content
 * (text, icons, child boxes) inside its padding box on both axes; a fixed
 * height or width, a nowrap label or an overflow clip makes it fail.
 *
 * - Content is gathered by walking the control's subtree, not with one Range
 *   or scrollHeight. Those also count the small buttons' `::before`
 *   hit-area pad (DESIGN §6.2) and the text of visually hidden helpers.
 * - Visually hidden subtrees (`sr-only`: an absolutely positioned box of
 *   1 px or less with a `clip` or `clip-path`) are skipped. Their text runs
 *   past their 1 px box by design and is never painted.
 * - Inline controls (links in running text) are skipped: an inline box
 *   never clips its content. Anything clipping them is an ancestor with
 *   `overflow` set, which the spec checks separately.
 * - Closed dialogs and controls that have no boxes are skipped.
 */
export function findCutOffControls(rootSelector: string): string[] {
  const TOLERANCE = 1;
  const root = document.querySelector(rootSelector);
  if (!root) return [`${rootSelector} not found`];

  const isVisuallyHidden = (element: Element): boolean => {
    const style = getComputedStyle(element);
    if (style.position !== "absolute" && style.position !== "fixed") {
      return false;
    }
    const clipped =
      (style.clip || "auto") !== "auto" ||
      (style.clipPath || "none") !== "none";
    const box = element.getBoundingClientRect();
    return clipped && box.width <= 1 && box.height <= 1;
  };

  const contentRects = (control: Element): DOMRect[] => {
    const rects: DOMRect[] = [];
    const walker = document.createTreeWalker(
      control,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: node =>
          node instanceof Element && isVisuallyHidden(node)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      }
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let found: Iterable<DOMRect>;
      if (node instanceof Element) {
        found = node.getClientRects();
      } else {
        const range = document.createRange();
        range.selectNodeContents(node);
        found = range.getClientRects();
      }
      for (const rect of found) {
        if (rect.width > 0 || rect.height > 0) rects.push(rect);
      }
    }
    return rects;
  };

  const problems: string[] = [];
  for (const control of root.querySelectorAll("a, button")) {
    if (control.closest("dialog")) continue;
    if (control.getClientRects().length === 0) continue;
    const style = getComputedStyle(control);
    if (style.display === "inline") continue;
    const box = control.getBoundingClientRect();
    const top = box.top + parseFloat(style.borderTopWidth || "0") - TOLERANCE;
    const bottom =
      box.bottom - parseFloat(style.borderBottomWidth || "0") + TOLERANCE;
    const left =
      box.left + parseFloat(style.borderLeftWidth || "0") - TOLERANCE;
    const right =
      box.right - parseFloat(style.borderRightWidth || "0") + TOLERANCE;
    const inside = contentRects(control).every(
      rect =>
        rect.top >= top &&
        rect.bottom <= bottom &&
        rect.left >= left &&
        rect.right <= right
    );
    if (!inside) {
      const name =
        control.textContent?.trim() || control.getAttribute("aria-label") || "";
      problems.push(
        `${control.tagName.toLowerCase()} "${name.slice(0, 40)}" is cut off`
      );
    }
  }
  return problems;
}
