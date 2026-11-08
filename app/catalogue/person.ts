import { formatDate } from "~/catalogue/format";
import { DECEASED_LABELS, PERSON_KIND_LABELS } from "~/constants/vocabulary";
import type { Person } from "~/schemas/catalogue";

/**
 * A person's status as their page says it, when it isn't "active": "Died 3
 * Oct 2026", or "Disbanded 3 Oct 2026" for a group, the date left out when
 * the API has none. Null for an active person, and for one who asked not
 * to have a page (their banner says so).
 */
export function personStatus(
  person: Pick<Person, "kind" | "status" | "status_date">
): string | null {
  if (person.status !== "deceased") return null;
  const label = DECEASED_LABELS[person.kind];
  return person.status_date
    ? `${label} ${formatDate(person.status_date)}`
    : label;
}

/**
 * A person's meta line under their name (plan §4.6): their kind, their
 * pronouns and their status, "Community bard · she/her · Died 3 Oct 2026".
 */
export function personSubtitle(person: Person): string {
  const status = personStatus(person);
  return [
    PERSON_KIND_LABELS[person.kind],
    ...(person.profile?.pronouns ? [person.profile.pronouns] : []),
    ...(status ? [status] : []),
  ].join(" · ");
}
