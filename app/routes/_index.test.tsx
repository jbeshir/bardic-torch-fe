import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import Index, { meta } from "./_index";

describe("Index route", () => {
  it("renders the site name as the page heading and what the site is", async () => {
    await renderWithRouter(<Index />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Bardic Torch" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A community-kept index of bardic pieces/)
    ).toBeInTheDocument();
  });

  it("is titled Bardic Torch, with a description", () => {
    const tags = meta({} as Parameters<typeof meta>[0]);
    expect(tags).toContainEqual({ title: "Bardic Torch" });
    expect(tags).toContainEqual(
      expect.objectContaining({ name: "description" })
    );
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<Index />));
  });
});
