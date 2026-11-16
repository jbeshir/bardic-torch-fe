import { IconAlertCircle } from "@tabler/icons-react";
import { createContext, use, type ReactNode } from "react";

type FieldControl = {
  readonly id: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
};

const FieldContext = createContext<FieldControl | null>(null);
FieldContext.displayName = "FieldContext";

/**
 * The attributes a text control (Input, Select) takes from the
 * Field around it: its id (the label's `for`), the help and error ids, the
 * invalid flag and `required`. Outside a Field there are none, and the
 * control needs its own `aria-label`.
 */
export function useFieldControl() {
  const field = use(FieldContext);
  if (!field) return { invalid: false, attributes: {} };
  return {
    invalid: field.invalid,
    attributes: {
      id: field.id,
      "aria-describedby": field.describedBy,
      "aria-invalid": field.invalid || undefined,
      required: field.required || undefined,
      "aria-required": field.required || undefined,
    },
  };
}

/** The ids of whichever help and error lines exist, for aria-describedby. */
export function describedBy(
  id: string,
  { help, error }: { help?: ReactNode; error?: ReactNode }
) {
  const ids = [help ? `${id}-help` : null, error ? `${id}-error` : null];
  return ids.filter(Boolean).join(" ") || undefined;
}

/** "(optional)" after a label; DESIGN marks optional fields, not required. */
export function OptionalMark() {
  return <span className="font-normal text-fg-subtle"> (optional)</span>;
}

export function FieldHelp({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <p id={id} className="mt-1 text-caption text-fg-muted">
      {children}
    </p>
  );
}

/** The error line under a control: icon plus plain words. */
export function FieldError({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <p
      id={id}
      className="mt-1.5 flex gap-1.5 text-caption font-medium text-danger-fg"
    >
      <IconAlertCircle
        size={16}
        stroke={1.75}
        aria-hidden="true"
        className="mt-px shrink-0 text-danger-icon"
      />
      <span>
        <span className="sr-only">Error: </span>
        {children}
      </span>
    </p>
  );
}
