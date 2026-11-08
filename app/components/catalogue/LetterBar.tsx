import { Link as RouterLink } from "react-router";
import { letterLabel } from "~/constants/vocabulary";
import { letterSchema, type Letter } from "~/schemas/catalogue";

const CELL =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-body-sm lg:min-h-8 lg:min-w-8";
const LINK = `${CELL} font-medium text-link transition-colors hover:bg-surface-sunken hover:text-link-hover`;
const CURRENT = `${CELL} bg-accent font-semibold text-accent-fg`;
const EMPTY = `${CELL} cursor-not-allowed text-fg-subtle`;

/** A cell's visible text and, where it differs, its accessible name. */
function CellText({ letter }: { readonly letter: Letter | undefined }) {
  if (letter === undefined) return "All";
  if (letter === "0") {
    return (
      <>
        <span aria-hidden="true">0–9</span>
        <span className="sr-only">{letterLabel(letter)}</span>
      </>
    );
  }
  return letter;
}

/**
 * The A–Z index of a list (plan §2.3, DESIGN §6.29): "All", then `0`
 * ("0–9 and others") and A to Z, each a link to the list under that letter.
 * A letter with no entries is plain text (`aria-disabled`), not a link. The
 * current cell is `aria-current="page"` on the accent fill and, like
 * Pagination's current page, not a link, so no ring is ever drawn on
 * accent. The links stay followable: letter pages are indexable.
 */
export function LetterBar({
  label,
  letters,
  current,
  href,
}: {
  /** The nav's name: "Pieces by letter". */
  readonly label: string;
  /** The letters with entries (the API's `letters` counts). */
  readonly letters: readonly { readonly letter: Letter }[];
  readonly current: Letter | undefined;
  /** The list under `letter`, or the whole list for undefined. */
  readonly href: (letter: Letter | undefined) => string;
}) {
  const present = new Set(letters.map(({ letter }) => letter));
  const cells: readonly (Letter | undefined)[] = [
    undefined,
    ...letterSchema.options,
  ];
  return (
    <nav aria-label={label}>
      <ul role="list" className="flex flex-wrap gap-1">
        {cells.map(letter => (
          <li key={letter ?? "all"}>
            {letter === current ? (
              <span aria-current="page" className={CURRENT}>
                <CellText letter={letter} />
              </span>
            ) : letter === undefined || present.has(letter) ? (
              <RouterLink to={href(letter)} prefetch="intent" className={LINK}>
                <CellText letter={letter} />
              </RouterLink>
            ) : (
              <span aria-disabled="true" className={EMPTY}>
                <CellText letter={letter} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
