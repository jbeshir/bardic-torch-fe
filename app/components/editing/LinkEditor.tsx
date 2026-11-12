import { IconChevronDown } from "@tabler/icons-react";
import { use } from "react";
import {
  LINK_PLACE_TYPE_LABELS,
  LINK_ROLE_LABELS,
} from "~/constants/vocabulary";
import type { PieceDocument } from "~/editing/documents";
import type { Options } from "~/editing/editor-data";
import {
  ChoicesField,
  FieldErrorsContext,
  labelOptions,
  Rows,
  SelectField,
  TextField,
} from "./fields";

type PieceLink = PieceDocument["links"][number];

/** A piece's link or a person's, whose performances name their piece. */
type Link = Omit<PieceLink, "performances"> & {
  readonly performances: readonly (PieceLink["performances"][number] & {
    readonly piece_slug?: string | null;
  })[];
};

/**
 * A piece's or a person's links, each with its performances. A person's
 * performance names its piece (`piece_slug`); a piece's is of the piece.
 */
export function LinkEditor({
  links,
  options,
  ofPerson,
}: {
  readonly links: readonly Link[];
  readonly options: Options;
  /** The links are a person's: a performance has a piece picker. */
  readonly ofPerson: boolean;
}) {
  const persons = options.persons ?? [];
  const errors = Object.keys(use(FieldErrorsContext));
  const roleOptions = labelOptions(LINK_ROLE_LABELS);
  return (
    <Rows
      legend="Links"
      path="links"
      rows={links}
      rowLabel={index => `Link ${index + 1}`}
      addLabel="Add a link"
    >
      {(link, name) => (
        // Folded, but open while it is new (no address yet) or has a problem.
        <details
          className="group grid gap-5"
          open={
            link.url === "" ||
            errors.some(key => key === name || key.startsWith(`${name}.`))
          }
        >
          <summary className="summary-plain flex min-h-6 cursor-pointer items-center justify-between gap-2 rounded-sm text-body-sm text-fg">
            <span>
              {link.title ?? (link.url === "" ? "New link" : link.url)}
              {link.roles.length > 0
                ? ` — ${roleOptions
                    .filter(({ value }) =>
                      (link.roles as readonly string[]).includes(value)
                    )
                    .map(({ label }) => label)
                    .join(", ")}`
                : ""}
            </span>
            <IconChevronDown
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="text-fg-subtle group-open:rotate-180"
            />
          </summary>
          <TextField
            name={`${name}.url`}
            label="Address (URL)"
            type="url"
            value={link.url}
          />
          <TextField
            name={`${name}.title`}
            label="Title"
            value={link.title}
            optional
          />
          <TextField
            name={`${name}.description`}
            label="Description"
            value={link.description}
            optional
          />
          <TextField
            name={`${name}.platform`}
            label="Platform"
            help="Where it is: ‘YouTube’, ‘Bandcamp’."
            value={link.platform}
            optional
          />
          <SelectField
            name={`${name}.place_type`}
            label="Kind of place"
            value={link.place_type}
            options={labelOptions(LINK_PLACE_TYPE_LABELS)}
            optional
          />
          <SelectField
            name={`${name}.collection_id`}
            label="Collection"
            value={link.collection_id}
            options={options.collections ?? []}
            optional
          />
          <TextField
            name={`${name}.locator`}
            label="Where in the collection"
            help="A page, track or timestamp: ‘p. 12’."
            value={link.locator}
            optional
          />
          <ChoicesField
            name={`${name}.roles`}
            legend="What it is"
            values={link.roles}
            options={roleOptions}
          />
          <Rows
            legend="Performances"
            path={`${name}.performances`}
            rows={link.performances}
            rowLabel={index => `Performance ${index + 1}`}
            addLabel="Add a performance"
          >
            {(performance, at) => (
              <>
                {ofPerson ? (
                  <SelectField
                    name={`${at}.piece_slug`}
                    label="Piece"
                    value={performance.piece_slug ?? null}
                    options={options.pieces ?? []}
                    optional
                  />
                ) : null}
                <SelectField
                  name={`${at}.event_slug`}
                  label="Event or venue"
                  value={performance.event_slug}
                  options={options.events ?? []}
                  optional
                />
                <TextField
                  name={`${at}.year`}
                  label="Year"
                  type="number"
                  value={performance.year}
                  optional
                />
                <TextField
                  name={`${at}.uploader`}
                  label="Uploaded by"
                  value={performance.uploader}
                  optional
                />
                <TextField
                  name={`${at}.description_verbatim`}
                  label="Description, as the page gives it"
                  value={performance.description_verbatim}
                  multiline
                  optional
                />
                <Rows
                  legend="Performers"
                  path={`${at}.performer_slugs`}
                  rows={performance.performer_slugs}
                  rowLabel={index => `Performer ${index + 1}`}
                  addLabel="Add a performer"
                >
                  {(slug, field) => (
                    <SelectField
                      name={field}
                      label="Person"
                      value={slug === "" ? null : slug}
                      options={persons}
                    />
                  )}
                </Rows>
              </>
            )}
          </Rows>
        </details>
      )}
    </Rows>
  );
}
