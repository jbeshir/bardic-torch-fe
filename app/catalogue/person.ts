import { DECEASED_LABELS, PERSON_KIND_LABELS } from "~/constants/vocabulary";
import type { Person } from "~/schemas/catalogue";

/**
 * A person's status as their page says it, when it isn't "active": "Died",
 * or "Disbanded" for a group. Null for an active person, and for one who
 * asked not to have a page (their banner says so).
 */
export function personStatus(
  person: Pick<Person, "kind" | "status">
): string | null {
  return person.status === "deceased" ? DECEASED_LABELS[person.kind] : null;
}

/**
 * A person's meta line under their name (plan §4.6): their kind and their
 * status, "Community bard · Died".
 */
export function personSubtitle(person: Person): string {
  const status = personStatus(person);
  return [PERSON_KIND_LABELS[person.kind], ...(status ? [status] : [])].join(
    " · "
  );
}
