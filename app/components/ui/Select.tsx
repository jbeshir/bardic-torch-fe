import { IconChevronDown } from "@tabler/icons-react";
import { forwardRef, type Ref, type SelectHTMLAttributes } from "react";
import { useFieldControl } from "./Field";
import { textControlClasses } from "./Input";

/**
 * A native select styled like Input (DESIGN §6.7). The options open in the
 * system picker, which follows the page's `color-scheme`, so it matches the
 * theme. Inside a Field it takes its id, descriptions and state from there.
 */
export const Select = forwardRef(function Select(
  {
    children,
    ...rest
  }: Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "className" | "style" | "id"
  >,
  ref: Ref<HTMLSelectElement>
) {
  const { invalid, attributes } = useFieldControl();
  return (
    <div className="relative">
      <select
        {...rest}
        {...attributes}
        ref={ref}
        className={`min-h-11 appearance-none pr-10 ${textControlClasses({ invalid })}`}
      >
        {children}
      </select>
      <IconChevronDown
        size={18}
        stroke={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
});
