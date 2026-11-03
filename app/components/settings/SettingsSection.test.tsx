import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { SettingsSection } from "./SettingsSection";

describe("SettingsSection", () => {
  it("is a section named by its h2", () => {
    render(
      <SettingsSection title="Profile">
        <p>Body</p>
      </SettingsSection>
    );
    const section = screen.getByRole("region", { name: "Profile" });
    expect(section).toHaveTextContent("ProfileBody");
    expect(
      screen.getByRole("heading", { level: 2, name: "Profile" })
    ).not.toHaveAttribute("tabindex");
  });

  it("with headingRef, the heading can take focus from code but is not in the tab order", () => {
    const heading = createRef<HTMLHeadingElement>();
    render(
      <SettingsSection title="API tokens" headingRef={heading}>
        <p>Body</p>
      </SettingsSection>
    );
    expect(heading.current).toHaveAttribute("tabindex", "-1");
    heading.current?.focus();
    expect(
      screen.getByRole("heading", { level: 2, name: "API tokens" })
    ).toHaveFocus();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <SettingsSection title="Profile">
          <p>Body</p>
        </SettingsSection>
      )
    );
  });
});
