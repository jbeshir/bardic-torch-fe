import { IconPlus, IconTrash } from "@tabler/icons-react";
import { createContext, use, type ReactNode } from "react";
import type { Option } from "~/editing/editor-data";
import { Button } from "~/components/ui/Button";
import { Checkbox, CheckboxGroup } from "~/components/ui/Checkbox";
import { Field, OptionalMark } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { Textarea } from "~/components/ui/Textarea";

/**
 * The controls an editor form is made of. Each takes `name`, the document
 * path with dots (`aliases.2`), which is also its id, so a 422 problem at
 * that path shows under it (from `FieldErrorsContext`, set by EditorPage).
 */

/** The help under a Markdown field. */
export const MARKDOWN_HELP =
  "Markdown: **bold**, *italic*, [a link](https://example.org) and lists.";

/** Each field's error by its id. */
export const FieldErrorsContext = createContext<
  Readonly<Record<string, string>>
>({});
FieldErrorsContext.displayName = "FieldErrorsContext";

type Common = {
  readonly name: string;
  readonly label: string;
  readonly help?: ReactNode;
  readonly optional?: boolean;
};

export function TextField({
  name,
  value,
  type,
  multiline = false,
  ...field
}: Common & {
  readonly value: string | number | null;
  readonly type?: "text" | "url" | "number";
  /** Markdown or other long text. */
  readonly multiline?: boolean;
}) {
  const error = use(FieldErrorsContext)[name];
  const control = { name, defaultValue: value ?? "" };
  return (
    <Field id={name} error={error} {...field}>
      {multiline ? (
        <Textarea {...control} />
      ) : (
        <Input
          {...control}
          {...(type === "number" ? { type, step: 1 } : type ? { type } : {})}
        />
      )}
    </Field>
  );
}

/** Options under `<optgroup>`s where they have a `group`, in order. */
function grouped(options: readonly Option[]) {
  const groups: { label: string | undefined; options: Option[] }[] = [];
  for (const option of options) {
    const last = groups.at(-1);
    if (last && last.label === option.group) last.options.push(option);
    else groups.push({ label: option.group, options: [option] });
  }
  return groups.map(({ label, options: items }) => {
    const rendered = items.map(({ value, label: text }) => (
      <option key={value} value={value}>
        {text}
      </option>
    ));
    return label === undefined ? (
      rendered
    ) : (
      <optgroup key={label} label={label}>
        {rendered}
      </optgroup>
    );
  });
}

/**
 * A native select. An optional one starts with "None" (null), and a
 * required one with no value with "Choose one", which `required` won't
 * submit. A value
 * that isn't among the options (a reference that isn't public now) is
 * kept as an option of its own, so it is never dropped unseen.
 */
export function SelectField({
  name,
  value,
  options,
  ...field
}: Common & {
  readonly value: string | number | null;
  readonly options: readonly Option[];
}) {
  const error = use(FieldErrorsContext)[name];
  const selected = value === null ? "" : String(value);
  const known = selected === "" || options.some(o => o.value === selected);
  return (
    <Field id={name} error={error} {...field}>
      <Select name={name} defaultValue={selected}>
        {field.optional ? (
          <option value="">None</option>
        ) : selected === "" ? (
          <option value="">Choose one</option>
        ) : null}
        {known ? null : <option value={selected}>{selected}</option>}
        {grouped(options)}
      </Select>
    </Field>
  );
}

/** A native multiple select: its choices are the name's repeated values. */
export function MultiSelectField({
  name,
  values,
  options,
  ...field
}: Common & {
  readonly values: readonly string[];
  readonly options: readonly Option[];
}) {
  const error = use(FieldErrorsContext)[name];
  const unknown = values.filter(v => !options.some(o => o.value === v));
  return (
    <Field
      id={name}
      error={error}
      help="Hold Ctrl (⌘ on a Mac) to choose more than one."
      {...field}
    >
      <Select name={name} multiple size={5} defaultValue={[...values]}>
        {unknown.map(value => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        {grouped(options)}
      </Select>
    </Field>
  );
}

/** Checkboxes under one legend, one per option, posting their values. */
export function ChoicesField({
  name,
  legend,
  values,
  options,
}: {
  readonly name: string;
  readonly legend: string;
  readonly values: readonly string[];
  readonly options: readonly Option[];
}) {
  const error = use(FieldErrorsContext)[name];
  return (
    <CheckboxGroup legend={legend} error={error} optional>
      {options.map(({ value, label }) => (
        <Checkbox
          key={value}
          name={name}
          value={value}
          label={label}
          defaultChecked={values.includes(value)}
        />
      ))}
    </CheckboxGroup>
  );
}

/**
 * A label record (`EVENT_KIND_LABELS`) as options, in its order, each
 * label with a capital (some records are for the middle of a sentence).
 */
export const labelOptions = (labels: Readonly<Record<string, string>>) =>
  Object.entries(labels).map(([value, label]) => ({
    value,
    label: `${label.charAt(0).toUpperCase()}${label.slice(1)}`,
  }));

/** A relation record's outgoing labels as options: "Variant of". */
export const relationOptions = (
  labels: Readonly<Record<string, { readonly outgoing: string }>>
) =>
  Object.entries(labels).map(([value, { outgoing }]) => ({
    value,
    label: outgoing,
  }));

/** A part of a long form: a fieldset headed by an h2. */
export function FormSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="mb-5 w-full">
        <h2 className="border-b border-border pb-2 text-h2 text-fg">{title}</h2>
      </legend>
      {children}
    </fieldset>
  );
}

export function CheckboxField({
  name,
  label,
  checked,
}: {
  readonly name: string;
  readonly label: string;
  readonly checked: boolean;
}) {
  const error = use(FieldErrorsContext)[name];
  return (
    <Checkbox
      name={name}
      label={label}
      defaultChecked={checked}
      error={error}
    />
  );
}

/**
 * A list of rows (`path.0`, `path.1`…) in a fieldset, each row its own
 * fieldset, with Remove on each and Add after them: submit buttons whose
 * `intent` the action applies, so they work without JavaScript.
 */
export function Rows<T>({
  legend,
  path,
  rows,
  rowLabel,
  addLabel,
  children,
}: {
  readonly legend: string;
  readonly path: string;
  readonly rows: readonly T[];
  /** A row's legend, from its index: "Other name 2". */
  readonly rowLabel: (index: number) => string;
  readonly addLabel: string;
  readonly children: (row: T, name: string) => ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-body-sm font-semibold text-fg">
        {legend}
        <OptionalMark />
      </legend>
      {rows
        .map((row, index) => ({ row, index, name: `${path}.${index}` }))
        .map(({ row, index, name }) => (
          <fieldset
            key={name}
            className="grid gap-5 rounded-lg border border-border p-4"
          >
            <legend className="px-1 text-body-sm font-medium text-fg-muted">
              {rowLabel(index)}
            </legend>
            {children(row, name)}
            <div>
              <Button
                type="submit"
                name="intent"
                value={`remove:${name}`}
                formNoValidate
                size="sm"
                variant="secondary-danger"
                icon={IconTrash}
              >
                Remove {rowLabel(index).toLowerCase()}
              </Button>
            </div>
          </fieldset>
        ))}
      <div>
        <Button
          type="submit"
          name="intent"
          value={`add:${path}`}
          formNoValidate
          icon={IconPlus}
        >
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
