import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOnServer, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("is closed, a focusable summary that opens it", async () => {
    const user = userEvent.setup();
    await renderWithRouter(
      <Disclosure summary="Status history (2)">
        <p>The entries.</p>
      </Disclosure>
    );
    const summary = screen.getByText("Status history (2)");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("The entries.")).not.toBeVisible();
    await user.tab();
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("The entries.")).toBeVisible();
  });

  it("is a native details element without JS", async () => {
    const html = await renderOnServer(
      <Disclosure summary="Show links">
        <p>Links.</p>
      </Disclosure>
    );
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Show links/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <Disclosure summary="More">
          <p>Body.</p>
        </Disclosure>
      )
    );
  });
});
