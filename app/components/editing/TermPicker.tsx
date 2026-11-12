import { linkClasses } from "~/components/ui/Link";
import { PIECE_PART_LABELS } from "~/constants/vocabulary";
import type { PieceDocument } from "~/editing/documents";
import type { Option } from "~/editing/editor-data";
import { CheckboxField, labelOptions, Rows, SelectField } from "./fields";

/**
 * A piece's categories: a term each, whether it is the main one of its
 * facet, and the part it is about. A term that isn't there yet is
 * suggested on its own page, in a new tab so this form is kept.
 */
export function TermPicker({
  terms,
  options,
}: {
  readonly terms: PieceDocument["terms"];
  readonly options: readonly Option[];
}) {
  return (
    <div className="grid gap-3">
      <Rows
        legend="Categories"
        path="terms"
        rows={terms}
        rowLabel={index => `Category ${index + 1}`}
        addLabel="Add a category"
      >
        {(term, name) => (
          <>
            <SelectField
              name={`${name}.term_slug`}
              label="Category"
              value={term.term_slug === "" ? null : term.term_slug}
              options={options}
            />
            <CheckboxField
              name={`${name}.is_primary`}
              label="The main one of its facet"
              checked={term.is_primary}
            />
            <SelectField
              name={`${name}.part`}
              label="Part"
              value={term.part}
              options={labelOptions(PIECE_PART_LABELS)}
              optional
            />
          </>
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
