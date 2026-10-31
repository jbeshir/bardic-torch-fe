import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LogoMark, UnlitMark } from "./LogoMark";
import { LOGO_MARK_PATHS } from "./logo-mark-paths";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

function renderMark() {
  const { container } = render(
    <p>
      <LogoMark className="h-6 w-6" />
      Bardic Torch
    </p>
  );
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg rendered");
  return { container, svg };
}

describe.each(["light", "dark"])("LogoMark (%s theme)", theme => {
  it("is decorative: hidden from assistive tech and never focusable", () => {
    document.documentElement.dataset.theme = theme;
    const { container, svg } = renderMark();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).not.toHaveAttribute("role");
    expect(container.querySelector("title")).toBeNull();
    expect(container.querySelector("p")).toHaveAccessibleName("");
    expect(container.querySelector("p")).toHaveTextContent("Bardic Torch");
  });

  it("takes its colours from currentColor and the accent tokens only", () => {
    document.documentElement.dataset.theme = theme;
    const { svg } = renderMark();
    const handle = [...svg.querySelectorAll("rect"), svg.querySelector("path")];
    for (const part of handle) {
      expect(part).toHaveAttribute("fill", "currentColor");
    }
    const [, flame, core] = [...svg.querySelectorAll("path")];
    expect(flame).toHaveClass("fill-accent");
    expect(core).toHaveClass("fill-logo-core");
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});

describe("LogoMark", () => {
  it("draws the shared torch geometry on a 24 × 24 grid, sized by its class", () => {
    const { svg } = renderMark();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveClass("h-6", "w-6");
    const paths = [...svg.querySelectorAll("path")].map(path =>
      path.getAttribute("d")
    );
    expect(paths).toEqual([
      LOGO_MARK_PATHS.handle,
      LOGO_MARK_PATHS.flame,
      LOGO_MARK_PATHS.core,
    ]);
    expect(svg.querySelectorAll("rect")).toHaveLength(
      LOGO_MARK_PATHS.cresset.length
    );
  });

  it("matches the generated favicon, which draws the same paths", () => {
    const favicon = readFileSync(
      join(process.cwd(), "public/favicon.svg"),
      "utf8"
    );
    for (const d of [
      LOGO_MARK_PATHS.handle,
      LOGO_MARK_PATHS.flame,
      LOGO_MARK_PATHS.core,
    ]) {
      expect(favicon).toContain(`d="${d}"`);
    }
  });
});

describe("UnlitMark", () => {
  it("is the same torch with its flame out: a border-strong outline, no fill", () => {
    const { container } = render(<UnlitMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveClass("h-12", "w-12", "text-fg-subtle");
    const [handle, flame] = [...container.querySelectorAll("path")];
    expect(handle).toHaveAttribute("d", LOGO_MARK_PATHS.handle);
    expect(handle).toHaveAttribute("fill", "currentColor");
    expect(flame).toHaveAttribute("d", LOGO_MARK_PATHS.flame);
    expect(flame).toHaveAttribute("fill", "none");
    expect(flame).toHaveClass("stroke-border-strong");
    expect(flame).toHaveAttribute("stroke-width", "1.5");
    expect(flame).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(flame).not.toHaveAttribute("stroke-dasharray");
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("dashes the outline for error pages, at 64 px", () => {
    const { container } = render(<UnlitMark size={64} dashed />);
    expect(container.querySelector("svg")).toHaveClass("h-16", "w-16");
    const flame = container.querySelectorAll("path")[1];
    expect(flame).toHaveAttribute("stroke-dasharray");
  });
});
