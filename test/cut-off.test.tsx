import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findCutOffControls } from "../e2e/support/cut-off";

/**
 * The text-spacing check in e2e/support/cut-off.ts. jsdom has no
 * layout, so each test lays out its nodes by hand: `place(node, ...rects)`
 * gives an element or text node its boxes (one per line fragment).
 */

type Box = readonly [left: number, top: number, width: number, height: number];

const layout = new Map<Node, readonly Box[]>();

function toRect([left, top, width, height]: Box) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  };
}

function rectsOf(node: Node) {
  return (layout.get(node) ?? []).map(toRect);
}

function place(node: Node | null, ...boxes: Box[]): void {
  if (!node) throw new Error("nothing to place");
  layout.set(node, boxes);
}

const originals = {
  elementRects: Element.prototype.getClientRects,
  elementBox: Element.prototype.getBoundingClientRect,
  rangeRects: Range.prototype.getClientRects,
};

beforeEach(() => {
  Element.prototype.getClientRects = function (this: Element) {
    return rectsOf(this) as unknown as DOMRectList;
  };
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const [first] = rectsOf(this);
    return (first ?? toRect([0, 0, 0, 0])) as DOMRect;
  };
  Range.prototype.getClientRects = function (this: Range) {
    return rectsOf(this.startContainer) as unknown as DOMRectList;
  };
});

afterEach(() => {
  Element.prototype.getClientRects = originals.elementRects;
  Element.prototype.getBoundingClientRect = originals.elementBox;
  Range.prototype.getClientRects = originals.rangeRects;
  layout.clear();
  document.body.innerHTML = "";
});

const SR_ONLY =
  "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap;";

/** A flex-item link like Link external="wiki": label, icon, hidden suffix. */
function externalLink(suffixStyle: string): void {
  document.body.innerHTML = `
    <div id="root">
      <a id="link" href="https://example.org" style="display: block">Lament<svg id="icon"></svg><span id="suffix" style="${suffixStyle}">(opens original wiki)</span></a>
    </div>`;
  const link = document.getElementById("link");
  if (!link) throw new Error("no link");
  place(link, [0, 0, 80, 24]);
  place(link.firstChild, [0, 0, 64, 24]);
  place(document.getElementById("icon"), [66, 6, 12, 12]);
}

describe("findCutOffControls", () => {
  it("ignores a visually hidden suffix whose text runs past its 1 px box", () => {
    externalLink(SR_ONLY);
    const suffix = document.getElementById("suffix");
    place(suffix, [79, 0, 1, 1]);
    place(suffix?.firstChild ?? null, [79, 0, 150, 24]);
    expect(findCutOffControls("#root")).toEqual([]);
  });

  it("still fails when the same text is visible and runs past the box", () => {
    externalLink("position: absolute;");
    const suffix = document.getElementById("suffix");
    place(suffix, [79, 0, 1, 1]);
    place(suffix?.firstChild ?? null, [79, 0, 150, 24]);
    expect(findCutOffControls("#root")).toEqual([
      'a "Lament(opens original wiki)" is cut off',
    ]);
  });

  it("fails a fixed-height button whose label wraps below it", () => {
    document.body.innerHTML = `<div id="root"><button style="display: inline-flex">Browse on the wiki</button></div>`;
    const button = document.querySelector("button");
    place(button, [0, 0, 60, 32]);
    place(button?.firstChild ?? null, [4, 4, 52, 24], [4, 28, 40, 24]);
    expect(findCutOffControls("#root")).toEqual([
      'button "Browse on the wiki" is cut off',
    ]);
  });

  it("fails a label that runs out sideways, and counts borders as outside", () => {
    document.body.innerHTML = `
      <div id="root">
        <a id="wide" href="/" style="display: inline-flex">12</a>
        <a id="border" href="/" style="display: inline-flex; border-style: solid; border-width: 4px">7</a>
      </div>`;
    const wide = document.getElementById("wide");
    place(wide, [0, 0, 44, 44]);
    place(wide?.firstChild ?? null, [10, 10, 40, 24]);
    const border = document.getElementById("border");
    place(border, [100, 0, 44, 44]);
    place(border?.firstChild ?? null, [101, 10, 20, 24]);
    expect(findCutOffControls("#root")).toEqual([
      'a "12" is cut off',
      'a "7" is cut off',
    ]);
  });

  it("allows content flush with the padding box, within 1 px", () => {
    document.body.innerHTML = `<div id="root"><a href="/" style="display: inline-flex; border-style: solid; border-width: 1px">Page 2</a></div>`;
    const link = document.querySelector("a");
    place(link, [0, 0, 44, 44]);
    place(link?.firstChild ?? null, [0.5, 0.5, 43.5, 43.5]);
    expect(findCutOffControls("#root")).toEqual([]);
  });

  it("doesn't treat a 1 px box as hidden unless it is clipped", () => {
    document.body.innerHTML = `<div id="root"><a href="/" style="display: block">Go<span id="tiny" style="position: absolute">more</span></a></div>`;
    const link = document.querySelector("a");
    place(link, [0, 0, 40, 24]);
    place(link?.firstChild ?? null, [0, 0, 20, 24]);
    const tiny = document.getElementById("tiny");
    place(tiny, [20, 0, 1, 1]);
    place(tiny?.firstChild ?? null, [20, 0, 40, 24]);
    expect(findCutOffControls("#root")).toEqual(['a "Gomore" is cut off']);
  });

  it("skips inline links in running text, closed dialogs and unrendered controls", () => {
    document.body.innerHTML = `
      <div id="root">
        <p><a id="inline" href="/" style="display: inline">a long wrapped link</a></p>
        <dialog><button style="display: inline-flex">Close</button></dialog>
        <button style="display: inline-flex">Not rendered</button>
      </div>`;
    const inline = document.getElementById("inline");
    place(inline, [0, 0, 30, 24]);
    place(inline?.firstChild ?? null, [0, 0, 200, 24]);
    const close = document.querySelector("dialog button");
    place(close, [0, 0, 10, 10]);
    place(close?.firstChild ?? null, [0, 0, 50, 24]);
    expect(findCutOffControls("#root")).toEqual([]);
  });

  it("reports a missing root", () => {
    expect(findCutOffControls("#nowhere")).toEqual(["#nowhere not found"]);
  });
});
