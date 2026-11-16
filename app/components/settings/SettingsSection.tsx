import { useId, type ReactNode } from "react";

/**
 * One part of the settings page: a section named by its h2,
 * with a rule under the heading.
 */
export function SettingsSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-10">
      <h2
        id={titleId}
        className="mb-4 border-b border-border pb-2 text-h2 text-fg"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
