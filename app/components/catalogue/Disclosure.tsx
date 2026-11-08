import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A native disclosure for something a page lists but doesn't lead with: a
 * status history, a restricted piece's links, the bards' filters. It is
 * `<details>`, so it works without JS and is closed until the reader opens
 * it; the summary is a 24 px target in the link colour, with a chevron
 * that turns when open. With `openWhen` (a media query) and JS, it starts
 * open where the query matches (the bards' filters column at xl).
 */
export function Disclosure({
  summary,
  openWhen,
  open,
  children,
}: {
  /** The summary's words: "Status history (3)". */
  readonly summary: string;
  readonly openWhen?: string;
  /** Open from the start (e.g. while a filter inside is applied). */
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && openWhen && window.matchMedia(openWhen).matches) {
      ref.current.open = true;
    }
  }, [openWhen]);
  return (
    <details ref={ref} open={open} className="group">
      <summary className="summary-plain inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-sm text-body-sm font-medium text-link hover:text-link-hover">
        {summary}
        <IconChevronDown
          size={16}
          stroke={1.75}
          aria-hidden="true"
          className="shrink-0 group-open:rotate-180"
        />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
