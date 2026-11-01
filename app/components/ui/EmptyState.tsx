import { useId, type ReactNode } from "react";
import { UnlitMark } from "~/components/LogoMark";

/**
 * "Nothing here yet" (DESIGN §6.15): the unlit torch, a heading, at most two
 * sentences and one action, centred in its container. A plain section named
 * by its heading; it is not a live region.
 */
export function EmptyState({
  title,
  children,
  action,
  headingLevel = 3,
}: {
  readonly title: string;
  /** One or two sentences: why it is empty and what to do. */
  readonly children: ReactNode;
  /** One primary or secondary Button or ButtonLink. */
  readonly action?: ReactNode;
  readonly headingLevel?: 2 | 3;
}) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center"
    >
      <UnlitMark />
      <Heading id={titleId} className="mt-4 text-h3 text-fg">
        {title}
      </Heading>
      <div className="mt-2 text-body-sm text-fg-muted">{children}</div>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
