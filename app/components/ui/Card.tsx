import { Link as RouterLink } from "react-router";
import { createContext, use, type ReactNode } from "react";

const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
} as const;

// An odd last card spans the two columns, rather than leaving half a row
// empty (until lg, where a three-column list has no half row to fill).
const ITEM = {
  2: "md:last:odd:col-span-2",
  3: "md:last:odd:col-span-2 lg:last:odd:col-span-1",
} as const;

/** The columns of the CardList a Card is in, if it is in one. */
const CardListColumnsContext = createContext<keyof typeof COLUMNS | null>(null);
CardListColumnsContext.displayName = "CardListColumnsContext";

const CARD_CLASSES =
  "group relative h-full rounded-lg border border-border bg-surface p-4 shadow-1 md:p-5";

/**
 * A content card: a box with a heading. Without `to` it is
 * the `static` variant: no link, no hover, no focus. With `to` it is the
 * `link` variant: the title is the link and its ::after stretches over the
 * whole card, which takes the hover edge and (on the ::after, since the card
 * itself can't be focused) the focus ring. In a CardList it is the
 * list's item.
 */
export function Card({
  title,
  eyebrow,
  meta,
  to,
  headingLevel = 3,
  headingId,
  children,
}: {
  readonly title: string;
  /** A short label above the title (`label-caps`). */
  readonly eyebrow?: string;
  /** A caption row under the body. */
  readonly meta?: ReactNode;
  /** An internal path: makes the whole card a link to it. */
  readonly to?: string;
  readonly headingLevel?: 2 | 3;
  /** The heading's id, for a link to the card: `#licensing`. */
  readonly headingId?: string;
  readonly children: ReactNode;
}) {
  const columns = use(CardListColumnsContext);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const card = (
    <div
      className={
        to
          ? `${CARD_CLASSES} transition-colors hover:border-border-strong`
          : CARD_CLASSES
      }
    >
      {eyebrow ? (
        <p className="mb-1 text-label-caps uppercase text-fg-subtle">
          {eyebrow}
        </p>
      ) : null}
      <Heading id={headingId} className="text-h3 text-fg">
        {to ? (
          <RouterLink
            to={to}
            prefetch="intent"
            className="text-link underline-offset-prose after:absolute after:inset-0 after:rounded-lg focus-visible:outline-hidden focus-visible:after:outline-solid focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus group-hover:text-link-hover group-hover:underline"
          >
            {title}
          </RouterLink>
        ) : (
          title
        )}
      </Heading>
      <div className="mt-2 text-body-sm text-fg-muted">{children}</div>
      {meta ? (
        <div className="mt-3 text-caption text-fg-subtle">{meta}</div>
      ) : null}
    </div>
  );
  return columns === null ? card : <li className={ITEM[columns]}>{card}</li>;
}

/**
 * Cards as a list: `ul role="list"`, each Card its own `li`,
 * one column, two from md and (with `columns` 3) three from lg. It is
 * `not-prose`, so inside help prose the list, heading and link styles of
 * `.prose-bt` leave the cards alone.
 */
export function CardList({
  columns = 3,
  children,
}: {
  /** The most columns: 2 within the prose measure, 3 on a full-width page. */
  readonly columns?: keyof typeof COLUMNS;
  readonly children: ReactNode;
}) {
  return (
    <ul role="list" className={`not-prose grid gap-4 ${COLUMNS[columns]}`}>
      <CardListColumnsContext value={columns}>
        {children}
      </CardListColumnsContext>
    </ul>
  );
}
