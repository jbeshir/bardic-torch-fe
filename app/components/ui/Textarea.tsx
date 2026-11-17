import type { Ref, TextareaHTMLAttributes } from "react";
import { useFieldControl } from "./Field";
import { textControlClasses } from "./Input";

/**
 * A multi-line text control: the Input look, at least five
 * lines tall and resizable vertically. Inside a Field it takes its id,
 * descriptions and state from there.
 */
export function Textarea({
  readOnly,
  ref,
  ...rest
}: Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "style" | "id"
> & { readonly ref?: Ref<HTMLTextAreaElement> }) {
  const { invalid, attributes } = useFieldControl();
  return (
    <textarea
      {...rest}
      {...attributes}
      ref={ref}
      readOnly={readOnly}
      className={`block min-h-textarea resize-y py-2.5 leading-relaxed ${textControlClasses({ invalid, readOnly })}`}
    />
  );
}
