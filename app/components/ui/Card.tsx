import { Link as RemixLink } from "@remix-run/react";
import { Children, type ReactNode } from "react";

/**
 * A content card (DESIGN §6.11): a box with a heading. Without `to` it is
 * the `static` variant: no link, no hover, no focus. With `to` it is the
 * `link` variant: the title is the link and its ::after stretches over the
 * whole card, which takes the hover edge and (on the ::after, since the card
 * itself can't be focused) the focus ring.
 */
export function Card({
  title,
  eyebrow,
  meta,
  to,
  headingLevel = 3,
  children,
}: {
  title: string;
  /** A short label above the title (`label-caps`). */
  eyebrow?: string;
  /** A caption row under the body. */
  meta?: ReactNode;
  /** An internal path: makes the whole card a link to it. */
  to?: string;
  headingLevel?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={`group relative h-full rounded-lg border border-border bg-surface p-4 shadow-1 md:p-5${to ? " transition-colors hover:border-border-strong" : ""}`}
    >
      {eyebrow ? (
        <p className="mb-1 text-label-caps uppercase text-fg-subtle">
          {eyebrow}
        </p>
      ) : null}
      <Heading className="text-h3 text-fg">
        {to ? (
          <RemixLink
            to={to}
            prefetch="intent"
            className="text-link underline-offset-prose after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus group-hover:text-link-hover group-hover:underline"
          >
            {title}
          </RemixLink>
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
}

/**
 * Cards as a list (DESIGN §6.11): `ul role="list"`, each card in an `li`,
 * one column, two from md and three from lg.
 */
export function CardList({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Children.map(children, card => (
        <li>{card}</li>
      ))}
    </ul>
  );
}
