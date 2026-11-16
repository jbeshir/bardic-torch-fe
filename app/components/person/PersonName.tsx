import type { ComponentProps } from "react";
import { Link } from "~/components/ui/Link";
import type { PersonSummary } from "~/schemas/catalogue";

/**
 * A person's name, linked to their page; plain text for a person who
 * prefers not to have a page (`slug` null).
 */
export function PersonName({
  person,
  ...look
}: Pick<ComponentProps<typeof Link>, "appearance" | "compact"> & {
  readonly person: Pick<PersonSummary, "slug" | "name">;
}) {
  if (person.slug === null) return person.name;
  return (
    <Link to={`/bards/${person.slug}`} {...look}>
      {person.name}
    </Link>
  );
}
