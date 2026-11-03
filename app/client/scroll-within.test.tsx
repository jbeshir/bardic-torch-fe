import { afterEach, describe, expect, it, vi } from "vitest";
import { showCurrentPage } from "./scroll-within";

/** A 300 px tall container of 1000 px content, its current item at `top`. */
function setUp(top: number | null, scrollTop = 0) {
  const container = document.createElement("div");
  container.innerHTML = `<a href="/a">A</a><a href="/b">B</a>`;
  const item = container.querySelector("a:last-child") as HTMLElement;
  if (top !== null) item.setAttribute("aria-current", "page");
  vi.spyOn(container, "scrollHeight", "get").mockReturnValue(1000);
  vi.spyOn(container, "clientHeight", "get").mockReturnValue(300);
  vi.spyOn(item, "offsetHeight", "get").mockReturnValue(40);
  container.scrollTop = scrollTop;
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    top: 100,
  } as DOMRect);
  vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
    top: 100 + (top ?? 0) - scrollTop,
  } as DOMRect);
  const scrollTo = vi.spyOn(window, "scrollTo");
  return { container, scrollTo };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("showCurrentPage", () => {
  it("scrolls the current item up into view with a margin, and only the container", () => {
    const { container, scrollTo } = setUp(600);
    showCurrentPage(container);
    // 600 + 40 - 300 + 16
    expect(container.scrollTop).toBe(356);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the current item above the end inset", () => {
    const { container } = setUp(600);
    showCurrentPage(container, { endInset: 24 });
    expect(container.scrollTop).toBe(380);
  });

  it("scrolls back up to an item above the visible part", () => {
    const { container } = setUp(200, 500);
    showCurrentPage(container);
    expect(container.scrollTop).toBe(184);
  });

  it("leaves a visible item, and a container without a current item, alone", () => {
    const visible = setUp(100);
    showCurrentPage(visible.container, { endInset: 24 });
    expect(visible.container.scrollTop).toBe(0);
    vi.restoreAllMocks();
    const none = setUp(null);
    showCurrentPage(none.container);
    expect(none.container.scrollTop).toBe(0);
  });
});
