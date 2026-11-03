import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { TokenList } from "./TokenList";

const TOKENS = [
  {
    id: "t-new",
    prefix: "7d3b5a6f",
    name: "Songbook importer",
    created_at: "2026-10-01T09:00:00Z",
    last_used_at: null,
  },
  {
    id: "t-unnamed",
    prefix: "9c1e7d3b",
    name: null,
    created_at: "2026-09-01T10:00:00Z",
    last_used_at: "2026-09-02T17:45:00Z",
  },
] as const;

describe("TokenList", () => {
  it("is a table from md, with a header row and one row per token", () => {
    render(<TokenList tokens={TOKENS} onRevoke={() => undefined} />);
    const table = screen.getByRole("table", { name: "Your API tokens" });
    expect(table).toHaveClass("hidden", "md:table");
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map(cell => cell.textContent)
    ).toEqual(["Songbook importer", "Token 9c1e7d3b…"]);
    const [, first, second] = within(table).getAllByRole("row");
    expect(first).toHaveTextContent("7d3b5a6f…1 Oct 2026Never");
    expect(second).toHaveTextContent("9c1e7d3b…1 Sep 20262 Sep 2026");
    expect(
      within(second as HTMLElement)
        .getAllByRole("cell")[1]
        ?.querySelector("time")
    ).toHaveAttribute("datetime", "2026-09-01T10:00:00Z");
  });

  it("is a list of cards below md, each headed by the token's name", () => {
    render(<TokenList tokens={TOKENS} onRevoke={() => undefined} />);
    const list = screen.getByRole("list", { name: "Your API tokens" });
    expect(list).toHaveClass("md:hidden");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[1] as HTMLElement).getByRole("heading", { level: 3 })
    ).toHaveTextContent("Token 9c1e7d3b…");
    expect(items[1]).toHaveTextContent(
      "Prefix9c1e7d3b…Created1 Sep 2026Last used2 Sep 2026"
    );
  });

  it("names each Revoke button after its token and reports which was pressed, by mouse or keyboard", async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    render(<TokenList tokens={TOKENS} onRevoke={onRevoke} />);
    const table = screen.getByRole("table");

    await user.click(
      within(table).getByRole("button", {
        name: "Revoke token Songbook importer",
      })
    );
    expect(onRevoke).toHaveBeenLastCalledWith(TOKENS[0]);

    within(table)
      .getByRole("button", { name: "Revoke token Token 9c1e7d3b…" })
      .focus();
    await user.keyboard("{Enter}");
    expect(onRevoke).toHaveBeenLastCalledWith(TOKENS[1]);
    await user.keyboard(" ");
    expect(onRevoke).toHaveBeenCalledTimes(3);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<TokenList tokens={TOKENS} onRevoke={() => undefined} />)
    );
  });
});
