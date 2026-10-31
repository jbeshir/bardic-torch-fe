import type { Icon } from "@tabler/icons-react";
import { forwardRef, type InputHTMLAttributes, type Ref } from "react";
import { useFieldControl } from "./Field";

/**
 * The text-control look shared by Input, Textarea and Select (DESIGN §6.5).
 * The error state adds an inset 1 px ring inside the border, so the edge is
 * 2 px without the content moving. Read-only values sit in a sunken well
 * with the border kept.
 */
export function textControlClasses({
  invalid,
  readOnly = false,
}: {
  invalid: boolean;
  readOnly?: boolean | undefined;
}): string {
  const edge = invalid
    ? "border-danger-icon ring-1 ring-inset ring-danger-icon"
    : "border-border-strong hover:border-fg-subtle";
  return (
    `w-full rounded-md border ${readOnly ? "bg-surface-sunken" : "bg-input-bg"} px-3 text-body text-fg transition-colors placeholder:text-fg-subtle ${edge} ` +
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-fg-subtle"
  );
}

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style" | "id" | "type"
> & {
  type?: "text" | "email" | "url" | "search" | "tel" | "password" | "number";
  /** A decorative 20 px icon before the value (e.g. a search glass). */
  icon?: Icon;
};

/**
 * A single-line text control (DESIGN §6.5). Inside a Field it takes its id,
 * descriptions and state from there; on its own it needs an `aria-label`.
 */
export const Input = forwardRef(function Input(
  { type = "text", icon: LeadingIcon, readOnly, ...rest }: InputProps,
  ref: Ref<HTMLInputElement>
) {
  const { invalid, attributes } = useFieldControl();
  const input = (
    <input
      {...rest}
      {...attributes}
      ref={ref}
      type={type}
      readOnly={readOnly}
      className={`min-h-11 ${textControlClasses({ invalid, readOnly })}${LeadingIcon ? " pl-10" : ""}`}
    />
  );
  if (!LeadingIcon) return input;
  return (
    <div className="relative">
      <LeadingIcon
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      {input}
    </div>
  );
});
