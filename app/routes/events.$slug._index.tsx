import { useId } from "react";
import { useRouteLoaderData } from "react-router";
import { EventPerformances } from "~/components/EventPerformances";
import type { loader as eventLoader } from "./events.$slug";

/**
 * `/events/:slug` (Read): the performances recorded there (plan §4.10),
 * from the layout's one read.
 */
export default function EventReadRoute() {
  const loaded = useRouteLoaderData<typeof eventLoader>("routes/events.$slug");
  const headingId = useId();
  if (!loaded) return null;
  const { event } = loaded;
  return (
    <section aria-labelledby={headingId} className="not-prose clear-both mt-8">
      <h2 id={headingId} className="mb-3 text-h3 text-fg">
        Performances recorded here
      </h2>
      <EventPerformances
        performances={event.performances}
        total={event.performances_total}
      />
    </section>
  );
}
