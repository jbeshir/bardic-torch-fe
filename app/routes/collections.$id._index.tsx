import { useId } from "react";
import { useRouteLoaderData } from "react-router";
import { Citations } from "~/components/Citations";
import { UserMarkdown } from "~/components/UserMarkdown";
import type { loader as collectionLoader } from "./collections.$id";

/**
 * `/collections/:id` (Read): the collection's description and its
 * citations (plan §4.9), from the layout's one read.
 */
export default function CollectionReadRoute() {
  const loaded = useRouteLoaderData<typeof collectionLoader>(
    "routes/collections.$id"
  );
  const citationsId = useId();
  if (!loaded) return null;
  const { collection, description } = loaded;
  return (
    <>
      {description ? <UserMarkdown tree={description} /> : null}
      <section
        aria-labelledby={citationsId}
        className="not-prose clear-both mt-8"
      >
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
