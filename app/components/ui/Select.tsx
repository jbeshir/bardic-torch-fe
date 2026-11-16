import { IconChevronDown } from "@tabler/icons-react";
import type { Ref, SelectHTMLAttributes } from "react";
import { useFieldControl } from "./Field";
import { textControlClasses } from "./Input";

/**
 * A native select styled like Input. The options open in the
 * system picker, which follows the page's `color-scheme`, so it matches the
 * theme; a `multiple` one is a list box, without the chevron. Inside a
 * Field it takes its id, descriptions and state from there.
 */
export function Select({
  children,
  ref,
  ...rest
}: Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "style" | "id"
> & {
  readonly ref?: Ref<HTMLSelectElement>;
}) {
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
      {rest.multiple ? null : (
        <IconChevronDown
          size={18}
          stroke={1.75}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted"
        />
      )}
    </div>
  );
}
