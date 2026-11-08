import type { ReactNode } from "react";

/** One column of a RowTable: its header and what each row shows in it. */
type Column<Row> = {
  readonly header: string;
  /** Keep the cell on one line: dates, years and short actions. */
  readonly nowrap?: boolean;
  readonly cell: (row: Row) => ReactNode;
};

const NOWRAP = "whitespace-nowrap tabular-nums";

/**
 * Rows of facts about things (citations, performances, revisions), as a
 * table from md and a list of cards below it, like the token list (DESIGN
 * §10.3). Only one of the two is displayed at a time, so assistive tech
 * meets each row once. The first column names the row: its row header in
 * the table, its card's first line; the rest are the card's term list.
 */
export function RowTable<Row>({
  label,
  rows,
  rowKey,
  columns: [first, ...rest],
}: {
  /** The table's and the list's accessible name. */
  readonly label: string;
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row, index: number) => string;
  readonly columns: readonly [Column<Row>, ...Column<Row>[]];
}) {
  return (
    <>
      <table
        aria-label={label}
        className="hidden w-full border-collapse text-left text-body-sm md:table"
      >
        <thead className="border-b border-border-strong text-fg-muted">
          <tr>
            {[first, ...rest].map(column => (
              <th
                key={column.header}
                scope="col"
                className="py-2 pr-4 font-semibold last:pr-0"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-fg">
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-b border-border">
              <th
                scope="row"
                className={`break-words py-3 pr-4 align-top font-normal ${first.nowrap ? NOWRAP : ""}`}
              >
                {first.cell(row)}
              </th>
              {rest.map(column => (
                <td
                  key={column.header}
                  className={`break-words py-3 pr-4 align-top last:pr-0 ${column.nowrap ? NOWRAP : ""}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul
        role="list"
        aria-label={label}
        className="wrap-anywhere flex flex-col gap-3 md:hidden"
      >
        {rows.map((row, index) => (
          <li
            key={rowKey(row, index)}
            className="rounded-lg border border-border bg-surface-raised p-4 text-body-sm"
          >
            <div className="text-body text-fg">{first.cell(row)}</div>
            <dl className="mt-2 grid grid-cols-infobox gap-x-4 gap-y-1">
              {rest.map(column => (
                <div key={column.header} className="contents">
                  <dt className="text-fg-muted">{column.header}</dt>
                  <dd className="text-fg">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
