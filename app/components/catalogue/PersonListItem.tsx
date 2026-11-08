import { Link } from "~/components/ui/Link";
import { PERSON_KIND_LABELS } from "~/constants/vocabulary";
import type { PersonSummary } from "~/schemas/catalogue";

/**
 * One person in a list of results (plan §4.7), a row like PieceListItem:
 * the name as a link to their page, their kind and "Stub" when their page
 * is one. A person who asked not to have a page is listed as a stub, like
 * any other (the API makes them indistinguishable), and links to their
 * identity page.
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
