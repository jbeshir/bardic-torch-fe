import { Link } from "~/components/ui/Link";
import { PERSON_KIND_LABELS } from "~/constants/vocabulary";
import type { PersonSummary } from "~/schemas/catalogue";

/**
 * One bard (a person or group) in a list (plan §4.8), a row of a
 * `ul role="list"` like `PieceListItem`: the name, a standalone link to
 * their page, then their kind and "Stub" when their page is one.
 */
export function PersonListItem({ person }: { readonly person: PersonSummary }) {
  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <div className="text-body-lg">
        <Link to={`/bards/${person.slug}`} compact>
          {person.name}
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
        <span>{PERSON_KIND_LABELS[person.kind]}</span>
        {person.is_stub ? (
          <span className="text-caption text-fg-subtle">Stub</span>
        ) : null}
      </div>
    </li>
  );
}
