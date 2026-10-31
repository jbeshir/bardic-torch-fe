import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Spinner } from "./Spinner";

function parts(container: HTMLElement) {
  const svg = container.querySelector("svg");
  const [track, arc] = [...(svg?.querySelectorAll("circle") ?? [])];
  return { svg, track, arc };
}

describe("Spinner", () => {
  it("is hidden from assistive tech", () => {
    const { svg } = parts(render(<Spinner />).container);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it.each([
    [16, "2"],
    [20, "2.5"],
    [24, "2.5"],
  ] as const)("is %i px with a %s px stroke", (size, stroke) => {
    const { svg, arc } = parts(render(<Spinner size={size} />).container);
    expect(svg).toHaveAttribute("width", String(size));
    expect(svg).toHaveAttribute("height", String(size));
    expect(arc).toHaveAttribute("stroke-width", stroke);
  });

  it("draws a three-quarter accent arc over a border-coloured track", () => {
    const { track, arc } = parts(render(<Spinner />).container);
    expect(track).toHaveClass("stroke-border");
    expect(arc).toHaveClass("stroke-accent");
    const [dash, gap] = (arc?.getAttribute("stroke-dasharray") ?? "")
      .split(" ")
      .map(Number);
    expect((dash ?? 0) / (gap ?? 1)).toBeCloseTo(0.75);
  });

  it("can take the surrounding text colour, for filled buttons", () => {
    const { track, arc } = parts(render(<Spinner tone="inherit" />).container);
    expect(track).toHaveClass("stroke-current", "opacity-30");
    expect(arc).toHaveClass("stroke-current");
  });

  it("turns only when motion is allowed, and pulses otherwise", () => {
    const { svg, arc } = parts(render(<Spinner />).container);
    expect(svg).toHaveClass("motion-safe:animate-spin");
    expect(arc).toHaveClass("motion-reduce:animate-pulse-soft");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() => render(<Spinner size={20} />));
  });
});
