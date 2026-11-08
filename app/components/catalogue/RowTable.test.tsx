import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { RowTable } from "./RowTable";

const ROWS = [
  { name: "Kettle", year: "1994" },
  { name: "Hoard", year: "2026" },
] as const;

function renderTable() {
  return render(
    <RowTable
      label="Performances"
      rows={ROWS}
      rowKey={row => row.name}
      columns={[
        { header: "Piece", cell: row => row.name },
        { header: "Year", cell: row => row.year },
      ]}
    />
  );
}

describe("RowTable", () => {
  it("is a table from md: the first column heads each row", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Performances" });
    expect(table).toHaveClass("hidden", "md:table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map(cell => cell.textContent)
    ).toEqual(["Piece", "Year"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map(cell => cell.textContent)
    ).toEqual(["Kettle", "Hoard"]);
    expect(within(table).getAllByRole("cell")[1]).toHaveTextContent("2026");
  });

  it("is a list of cards below md, each naming its row", () => {
    renderTable();
    const list = screen.getByRole("list", { name: "Performances" });
    expect(list).toHaveClass("md:hidden");
    const [first] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent("KettleYear1994");
    expect(within(first as HTMLElement).getByRole("term")).toHaveTextContent(
      "Year"
    );
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderTable());
  });
});
