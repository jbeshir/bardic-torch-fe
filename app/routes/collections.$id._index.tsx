import { useId } from "react";
import { useRouteLoaderData } from "react-router";
import { Citations } from "~/components/Citations";
import { Link } from "~/components/ui/Link";
import { UserMarkdown } from "~/components/UserMarkdown";
import { COLLECTION_KIND_LABELS } from "~/constants/vocabulary";
import type { loader as collectionLoader } from "./collections.$id";

/**
 * `/collections/:id` (Read): the collection's description, the
 * collections that are part of it, and its citations (plan §4.9), all from
 * the layout's one read.
 */
export default function CollectionReadRoute() {
  const loaded = useRouteLoaderData<typeof collectionLoader>(
    "routes/collections.$id"
  );
  const partsId = useId();
  const citationsId = useId();
  if (!loaded) return null;
  const { collection, description } = loaded;
  return (
    <>
      {description ? <UserMarkdown tree={description} /> : null}
      {collection.children.length > 0 ? (
        <section aria-labelledby={partsId} className="not-prose mt-8">
          <h2 id={partsId} className="mb-3 text-h3 text-fg">
            Part collections
          </h2>
          <ul role="list" className="grid gap-1">
            {collection.children.map(child => (
              <li key={child.id} className="flex flex-wrap gap-x-2">
                <Link to={`/collections/${child.id}`} compact>
                  {child.name}
                </Link>
                <span className="text-body-sm text-fg-muted">
                  {COLLECTION_KIND_LABELS[child.kind]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby={citationsId} className="not-prose mt-8">
        <h2 id={citationsId} className="mb-3 text-h3 text-fg">
          Citations
        </h2>
        <Citations
          citations={collection.citations}
          total={collection.citations_total}
        />
      </section>
    </>
  );
}
