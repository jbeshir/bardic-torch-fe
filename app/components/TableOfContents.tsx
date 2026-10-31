import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useId, useRef } from "react";

type Section = {
  /** The heading's id, the link target. */
  readonly id: string;
  readonly label: string;
};

export type TocEntry = Section & {
  /** The h3s under this h2. */
  readonly children?: readonly Section[];
};

/** Below md the contents start folded, out of the way of the first prose. */
const MD_QUERY = "(min-width: 768px)";

const ITEM =
  "inline-flex min-h-6 items-baseline gap-2 rounded-sm text-link no-underline underline-offset-prose hover:text-link-hover hover:underline";

function Item({ number, section }: { number: string; section: Section }) {
  return (
    <a href={`#${section.id}`} className={ITEM}>
      <span className="tabular-nums text-fg-subtle">{number}</span>
      {section.label}
    </a>
  );
}

/**
 * A help page's contents (DESIGN §6.27): a numbered list of its h2s and
 * h3s in a disclosure, inline after the intro. It is open as the server
 * renders it (and without JS); with JS it folds itself below md.
 */
export function TableOfContents({ entries }: { entries: readonly TocEntry[] }) {
  const titleId = useId();
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current && !window.matchMedia(MD_QUERY).matches) {
      details.current.open = false;
    }
  }, []);

  return (
    <nav
      aria-labelledby={titleId}
      className="my-6 max-w-prose rounded-lg bg-surface-sunken p-4"
    >
      <details ref={details} open className="group">
        <summary className="summary-plain flex min-h-6 cursor-pointer items-center justify-between gap-2 rounded-sm">
          <span
            id={titleId}
            className="font-sans text-label-caps uppercase text-fg-subtle"
          >
            Contents
          </span>
          <IconChevronDown
            size={16}
            stroke={1.75}
            aria-hidden="true"
            className="text-fg-subtle group-open:rotate-180"
          />
        </summary>
        <ol
          role="list"
          className="mb-0 mt-3 list-none space-y-1 pl-0 text-body-sm"
        >
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <Item number={`${index + 1}`} section={entry} />
              {entry.children && entry.children.length > 0 ? (
                <ol role="list" className="mb-0 mt-1 list-none space-y-1 pl-6">
                  {entry.children.map((child, childIndex) => (
                    <li key={child.id}>
                      <Item
                        number={`${index + 1}.${childIndex + 1}`}
                        section={child}
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
