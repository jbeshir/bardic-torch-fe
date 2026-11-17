import { linkClasses } from "~/components/ui/Link";
import type { PieceDocument } from "~/editing/documents";
import type { Option } from "~/editing/editor-data";
import { Rows, SelectField } from "./fields";

/**
 * A piece's categories, a term each, in order. A term that isn't there yet is
 * suggested on its own page, in a new tab so this form is kept.
 */
export function TermPicker({
  terms,
  options,
}: {
  readonly terms: PieceDocument["term_slugs"];
  readonly options: readonly Option[];
}) {
  return (
    <div className="grid gap-3">
      <Rows
        legend="Categories"
        path="term_slugs"
        rows={terms}
        rowLabel={index => `Category ${index + 1}`}
        addLabel="Add a category"
      >
        {(slug, name) => (
          <SelectField
            name={name}
            label="Category"
            value={slug === "" ? null : slug}
            options={options}
          />
        )}
      </Rows>
      <p className="text-body-sm">
        <a
          href="/categories/new"
          target="_blank"
          className={`inline-flex min-h-6 items-center ${linkClasses("prose")}`}
        >
          Suggest a new term (opens in a new tab)
        </a>
      </p>
    </div>
  );
}
