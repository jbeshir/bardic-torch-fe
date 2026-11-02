import type { ReactNode } from "react";

type SkeletonShape = "line" | "heading" | "chip";

/** DESIGN §6.18: full, 92 % and 60 % (the last line of a paragraph). */
const LINE_WIDTHS = {
  full: "w-full",
  most: "w-11/12",
  part: "w-3/5",
} as const;

const SHAPES: Record<Exclude<SkeletonShape, "line">, string> = {
  heading: "h-8 w-2/3 rounded-md",
  chip: "h-8 w-20 rounded-full",
};

/**
 * One placeholder block (DESIGN §6.18). A `line` takes the line height of the
 * text style it sits in, so swapping in the real text doesn't shift the
 * layout. Always hidden from assistive tech: the SkeletonRegion around it
 * says what is loading.
 */
export function Skeleton({
  shape = "line",
  width = "full",
}: {
  readonly shape?: SkeletonShape;
  /** Line length; only for `line`. */
  readonly width?: keyof typeof LINE_WIDTHS;
}) {
  if (shape === "line") {
    return (
      <span aria-hidden="true" className="block">
        <Block
          className={`inline-block h-text-line rounded-md align-middle ${LINE_WIDTHS[width]}`}
        />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="block">
      <Block className={`block ${SHAPES[shape]}`} />
    </span>
  );
}

function Block({ className }: { readonly className: string }) {
  return (
    <span className={`relative overflow-hidden bg-surface-sunken ${className}`}>
      <span className="absolute inset-0 hidden bg-shimmer motion-safe:block motion-safe:animate-shimmer" />
    </span>
  );
}

/**
 * The busy region around skeleton blocks: `aria-busy` while loading, and one
 * hidden "Loading {thing}…" for screen readers.
 */
export function SkeletonRegion({
  label,
  children,
}: {
  /** What is loading, e.g. "page details". */
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading {label}…</span>
      {children}
    </div>
  );
}
