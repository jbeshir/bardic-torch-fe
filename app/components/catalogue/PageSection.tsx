import type { ReactNode } from "react";
import type { TocEntry } from "~/components/TableOfContents";

/**
 * One of an entity page's sections (plan §4.5): an h2 with the prose rule,
 * which the page's contents link to by its `id`, and its content.
 */
function PageSection({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** A body section: its contents entry and the section itself. */
export type PageSectionEntry = TocEntry & { readonly element: ReactNode };

/** A section with an h2 of its own, as an entry of the page's sections. */
export function pageSection(
  id: string,
  label: string,
  content: ReactNode
): PageSectionEntry {
  return {
    id,
    label,
    element: (
      <PageSection id={id} title={label}>
        {content}
      </PageSection>
    ),
  };
}
