import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Skeleton, SkeletonRegion } from "./Skeleton";

function block(container: HTMLElement) {
  return container.querySelector("[aria-hidden] > span");
}

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["full", "w-full"],
    ["most", "w-11/12"],
    ["part", "w-3/5"],
  ] as const)(
    "draws a %s text line at the text's line height",
    (width, cls) => {
      const { container } = render(<Skeleton width={width} />);
      // A block line box holds an inline bar, so the line keeps its height.
      expect(container.firstElementChild).toHaveClass("block");
      expect(block(container)).toHaveClass(
        "inline-block",
        "h-text-line",
        "bg-surface-sunken",
        cls
      );
    }
  );

  it.each([
    ["heading", ["h-8", "w-2/3", "rounded-md"]],
    ["chip", ["h-8", "w-20", "rounded-full"]],
  ] as const)("draws a %s block", (shape, classes) => {
    const { container } = render(<Skeleton shape={shape} />);
    expect(block(container)).toHaveClass("bg-surface-sunken", ...classes);
  });

  it("shimmers only when motion is allowed", () => {
    const { container } = render(<Skeleton />);
    const shimmer = block(container)?.firstElementChild;
    expect(shimmer).toHaveClass(
      "hidden",
      "motion-safe:block",
      "motion-safe:animate-shimmer",
      "bg-shimmer"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <>
          <Skeleton shape="heading" />
          <Skeleton />
          <Skeleton shape="chip" />
        </>
      )
    );
  });
});

describe("SkeletonRegion", () => {
  it("is busy and says once what is loading", () => {
    render(
      <SkeletonRegion label="page details">
        <Skeleton />
        <Skeleton width="part" />
      </SkeletonRegion>
    );
    const status = screen.getByText("Loading page details…");
    expect(status).toHaveClass("sr-only");
    expect(status.parentElement).toHaveAttribute("aria-busy", "true");
  });
});
