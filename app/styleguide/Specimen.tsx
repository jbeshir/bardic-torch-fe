import { createContext, useContext, type ReactNode } from "react";

/**
 * Each forced-theme copy of the gallery prefixes its anchors, so the two
 * side-by-side copies never share an id; the "Current" copy has none, which makes
 * `/styleguide#button` and the e2e checkpoints point at it.
 */
export const AnchorPrefix = createContext("");

/** A component's block: an anchored h2 and its examples. */
export function Specimen({
  id,
  title,
  summary,
  children,
}: {
  /** The anchor, e.g. "button" for `/styleguide#button`. */
  readonly id: string;
  readonly title: string;
  /** One line on what it is for, with its DESIGN section. */
  readonly summary: ReactNode;
  readonly children: ReactNode;
}) {
  const prefix = useContext(AnchorPrefix);
  return (
    <section
      id={`${prefix}${id}`}
      aria-labelledby={`${prefix}${id}-title`}
      data-specimen={id}
      className="scroll-mt-4 border-t border-border py-8 first:border-t-0 first:pt-0"
    >
      <h2 id={`${prefix}${id}-title`} className="text-h2 text-fg">
        {title}
      </h2>
      <p className="mt-1 max-w-prose text-body-sm text-fg-muted">{summary}</p>
      <div className="mt-6 grid gap-6">{children}</div>
    </section>
  );
}

/** One state or variant, captioned with what it shows. */
export function Example({
  label,
  children,
  wide = false,
  stack = false,
}: {
  readonly label: string;
  readonly children: ReactNode;
  /** Let the example run the full width (a layout or a list). */
  readonly wide?: boolean;
  /** Put the parts under each other (fields) instead of in a row. */
  readonly stack?: boolean;
}) {
  return (
    <figure className={wide ? "min-w-0" : "min-w-0 max-w-form"}>
      <figcaption className="mb-2 font-sans text-label-caps uppercase text-fg-subtle">
        {label}
      </figcaption>
      <div
        className={stack ? "grid gap-5" : "flex flex-wrap items-start gap-3"}
      >
        {children}
      </div>
    </figure>
  );
}
