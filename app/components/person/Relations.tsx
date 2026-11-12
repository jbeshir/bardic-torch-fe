import { useId } from "react";
import { PersonName } from "~/components/person/PersonName";
import {
  PERSON_KIND_LABELS,
  PERSON_RELATION_LABELS,
} from "~/constants/vocabulary";
import type { Person } from "~/schemas/catalogue";

type Relation = NonNullable<Person["profile"]>["relations"][number];

function Group({
  label,
  relations,
}: {
  readonly label: string;
  readonly relations: readonly Relation[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{label}</h3>
      <ul role="list" className="not-prose grid gap-2">
        {relations.map(({ person }) => (
          <li key={person.slug ?? person.name} className="text-body">
            <PersonName person={person} />{" "}
            <span className="text-body-sm text-fg-muted">
              {PERSON_KIND_LABELS[person.kind]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A person's relations to other persons (plan §4.6), grouped by how they
 * read from this person: "Member of" a group (outgoing), a group's
 * "Members" (incoming), "Heir of" and "Heirs", and "Also recorded as" both
 * ways. A person who asked not to have a page is named without a link.
 */
export function Relations({
  relations,
}: {
  readonly relations: readonly Relation[];
}) {
  const groups = new Map<string, Relation[]>();
  for (const relation of relations) {
    const label = PERSON_RELATION_LABELS[relation.type][relation.direction];
    groups.set(label, [...(groups.get(label) ?? []), relation]);
  }
  return [...groups].map(([label, members]) => (
    <Group key={label} label={label} relations={members} />
  ));
}
