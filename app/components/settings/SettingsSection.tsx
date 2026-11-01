import { useId, type ReactNode, type RefObject } from "react";

/**
 * One part of the settings page (DESIGN §10.3): a section named by its h2,
 * with a rule under the heading. `headingRef` makes the heading a focus
 * target (`tabindex="-1"`), for when the control that had focus goes away.
 */
export function SettingsSection({
  title,
  headingRef,
  children,
}: {
  title: string;
  headingRef?: RefObject<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-10">
      <h2
        id={titleId}
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="mb-4 border-b border-border pb-2 text-h2 text-fg"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
