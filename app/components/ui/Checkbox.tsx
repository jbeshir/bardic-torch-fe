import { IconCheck, IconMinus } from "@tabler/icons-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { describedBy, FieldError, FieldHelp, OptionalMark } from "./Field";

/** Set by a CheckboxGroup with an error, so every box shows it. */
const GroupInvalid = createContext(false);

const MARK =
  "pointer-events-none absolute inset-0 m-auto hidden text-accent-fg peer-disabled:text-fg-subtle forced-colors:!hidden";

/**
 * A native checkbox drawn from tokens (DESIGN §6.8). The whole row is the
 * label, so it is the hit area; help text sits under the label text and is
 * the box's description. In forced-colours mode the system draws the box
 * (`forced-colors:appearance-auto`; a utility, because base.css can't
 * override one) and the token-drawn marks step aside, so checked and unchecked
 * never look the same.
 */
export function Checkbox({
  label,
  help,
  error,
  indeterminate = false,
  disabled,
  ...rest
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style" | "id" | "type" | "children"
> & {
  label: ReactNode;
  help?: ReactNode;
  /** A message for this box alone; in a group, give the group the error. */
  error?: ReactNode;
  /** The "some of these" state, e.g. for a select-all box. */
  indeterminate?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const invalid = useContext(GroupInvalid) || Boolean(error);

  // `indeterminate` is a DOM property only; there is no attribute for it.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const edge = invalid ? "border-danger-icon" : "border-border-strong";
  const cursor = disabled ? "cursor-not-allowed" : "cursor-pointer";
  return (
    <div>
      <label className={`flex gap-3 py-2.5 lg:py-1 ${cursor}`}>
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0">
          <input
            {...rest}
            ref={ref}
            id={id}
            type="checkbox"
            disabled={disabled}
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy(id, { help, error })}
            aria-invalid={invalid || undefined}
            className={`peer h-5 w-5 ${cursor} appearance-none rounded-sm border-2 ${edge} bg-surface-raised transition-colors hover:border-fg-subtle checked:border-accent checked:bg-accent checked:hover:border-accent-hover checked:hover:bg-accent-hover indeterminate:border-accent indeterminate:bg-accent disabled:border-border-strong disabled:bg-input-bg-locked forced-colors:appearance-auto`}
          />
          <IconCheck
            size={16}
            stroke={3}
            aria-hidden="true"
            className={`${MARK} peer-checked:block peer-indeterminate:hidden`}
          />
          <IconMinus
            size={16}
            stroke={3}
            aria-hidden="true"
            className={`${MARK} peer-indeterminate:block`}
          />
        </span>
        <span className="min-w-0">
          <span
            id={`${id}-label`}
            className={`block text-body ${disabled ? "text-fg-subtle" : "text-fg"}`}
          >
            {label}
          </span>
          {help ? <FieldHelp id={`${id}-help`}>{help}</FieldHelp> : null}
        </span>
      </label>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

/**
 * Related checkboxes under one label (DESIGN §6.8): a fieldset whose legend
 * looks like a field label, with optional help and one error for the group.
 */
export function CheckboxGroup({
  legend,
  help,
  error,
  optional = false,
  children,
}: {
  legend: string;
  help?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={describedBy(id, { help, error })}>
      <legend className="text-body-sm font-semibold text-fg">
        {legend}
        {optional ? <OptionalMark /> : null}
      </legend>
      {help ? <FieldHelp id={`${id}-help`}>{help}</FieldHelp> : null}
      <div className="mt-1">
        <GroupInvalid.Provider value={Boolean(error)}>
          {children}
        </GroupInvalid.Provider>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </fieldset>
  );
}
