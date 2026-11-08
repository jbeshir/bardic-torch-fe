import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  CONSERVATION_LABELS,
  CONSERVATION_STATUSES,
} from "~/constants/vocabulary";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ConservationBadge } from "./ConservationBadge";

describe("ConservationBadge", () => {
  it.each([
    ["low_risk", "Low risk", "cons-low"],
    ["endangered", "Endangered", "cons-end"],
    ["critically_endangered", "Critically endangered", "cons-crit"],
    ["restricted", "Restricted", "cons-res"],
    ["unassessed", "Not yet assessed", "cons-un"],
  ] as const)(
    "shows %s as a static pill with its icon, label and tokens",
    async (status, label, token) => {
      await renderWithRouter(<ConservationBadge status={status} />);
      const badge = screen.getByText(label).closest("span.rounded-full");
      expect(badge?.tagName).toBe("SPAN");
      expect(badge).toHaveTextContent(`Conservation status: ${label}`);
      expect(badge).toHaveClass(
        `bg-${token}-bg`,
        `text-${token}-fg`,
        `border-${token}-border`,
        "rounded-full",
        "inline-flex"
      );
      const icon = badge?.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveClass(`text-${token}-border`);
      expect(screen.queryByRole("link")).toBeNull();
    }
  );

  it("labels every status in sentence case", () => {
    for (const status of CONSERVATION_STATUSES) {
      const label = CONSERVATION_LABELS[status];
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    }
  });

  it("sets the extremes apart by more than colour: 2 px and dashed borders", async () => {
    await renderWithRouter(
      <>
        <ConservationBadge status="critically_endangered" />
        <ConservationBadge status="unassessed" />
        <ConservationBadge status="endangered" />
      </>
    );
    const pill = (label: string) =>
      screen.getByText(label).closest("span.rounded-full");
    expect(pill("Critically endangered")).toHaveClass("border-2");
    expect(pill("Critically endangered")).not.toHaveClass("border-dashed");
    expect(pill("Not yet assessed")).toHaveClass("border", "border-dashed");
    expect(pill("Endangered")).toHaveClass("border");
    expect(pill("Endangered")).not.toHaveClass("border-2", "border-dashed");
    // Each status has its own icon shape.
    const shapes = ["Critically endangered", "Not yet assessed", "Endangered"]
      .map(label => pill(label)?.querySelector("svg")?.classList ?? [])
      .map(classes =>
        [...classes].find(
          name => name.startsWith("tabler-icon-") && name !== "tabler-icon"
        )
      );
    expect(shapes).not.toContain(undefined);
    expect(new Set(shapes).size).toBe(3);
  });

  it.each([
    ["sm", ["min-h-6", "px-2", "text-caption", "gap-1"], "14"],
    ["md", ["min-h-7", "px-2.5", "text-body-sm", "font-medium"], "16"],
  ] as const)("has %s size", async (size, classes, iconSize) => {
    await renderWithRouter(
      <ConservationBadge status="endangered" size={size} />
    );
    const badge = screen.getByText("Endangered").closest("span.rounded-full");
    expect(badge).toHaveClass(...classes);
    expect(badge?.querySelector("svg")).toHaveAttribute("width", iconSize);
  });

  it("leaves the hidden prefix out where the context names it", async () => {
    await renderWithRouter(<ConservationBadge status="restricted" named />);
    expect(screen.queryByText("Conservation status:")).toBeNull();
    expect(screen.getByText("Restricted")).toBeInTheDocument();
  });

  it("links to the status's entry on the help page, named in full", async () => {
    await renderWithRouter(
      <ConservationBadge status="critically_endangered" size="sm" link named />
    );
    const link = screen.getByRole("link", {
      name: "Conservation status: Critically endangered",
    });
    expect(link).toHaveAttribute(
      "href",
      "/help/conservation-status#critically_endangered"
    );
    expect(link).toHaveClass("group", "rounded-full", "border-2");
    expect(link.querySelector(".group-hover\\:underline")).toHaveTextContent(
      "Critically endangered"
    );
  });

  it("is reached with Tab and followed with Enter", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <ConservationBadge status="endangered" link />
    );
    await act(() => user.tab());
    const link = screen.getByRole("link", {
      name: "Conservation status: Endangered",
    });
    expect(link).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help/conservation-status");
    expect(router.state.location.hash).toBe("#endangered");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <>
          {CONSERVATION_STATUSES.map(status => (
            <ConservationBadge key={status} status={status} />
          ))}
          <ConservationBadge status="endangered" size="sm" link />
        </>
      )
    );
  });
});
