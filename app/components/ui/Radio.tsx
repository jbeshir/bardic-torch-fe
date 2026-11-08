import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A native radio button drawn from tokens, the round sibling of Checkbox
 * (DESIGN §6.8): a 20 px ring that fills with an accent dot when chosen.
 * The whole row is the label, so it is the hit area (44 px below lg, 32 px
 * from lg). Group radios in a `<fieldset>` with a legend, all with one
 * `name`. In forced colours the system draws the control and the dot
 * steps aside.
 */
export function Radio({
  label,
  ...rest
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style" | "type" | "children"
> & {
  readonly label: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer gap-3 py-2.5 lg:py-1">
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0">
        <input
          {...rest}
          type="radio"
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-border-strong bg-surface-raised transition-colors hover:border-fg-subtle checked:border-accent checked:hover:border-accent-hover forced-colors:appearance-auto"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto hidden h-2.5 w-2.5 rounded-full bg-accent peer-checked:block forced-colors:hidden!"
        />
      </span>
      <span className="min-w-0 text-body text-fg">{label}</span>
    </label>
  );
}
