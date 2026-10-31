import { forwardRef, type Ref, type TextareaHTMLAttributes } from "react";
import { useFieldControl } from "./Field";
import { textControlClasses } from "./Input";

/**
 * A multi-line text control (DESIGN §6.6): the Input look, at least five
 * lines tall and resizable vertically. Inside a Field it takes its id,
 * descriptions and state from there.
 */
export const Textarea = forwardRef(function Textarea(
  {
    readOnly,
    ...rest
  }: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "style" | "id"
  >,
  ref: Ref<HTMLTextAreaElement>
) {
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
});
