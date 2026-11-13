import { failureMeta } from "~/catalogue/entity-route";
import { IconBook2 } from "@tabler/icons-react";
import { useId } from "react";
import {
  useLoaderData,
  useNavigation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { ViewTabs } from "~/components/ui/Tabs";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import { redirectPastTheEnd, showingText } from "~/catalogue/paging";
import {
  eventQuery,
  redirectIfNotCanonical,
  type EventQueryState,
} from "~/catalogue/query-state";
import { throwPageFailure, thrownPageFailure } from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { useErrorReference } from "~/hooks/useErrorReference";
import { useResultsFocus } from "~/hooks/useResultsFocus";
import type { EventList } from "~/schemas/catalogue";
import { listEvents } from "~/server/catalogue.server";

/**
 * `/events`: the events pieces were performed at (plan §4.10), by name.
 * The API has no A–Z and no search for them, so the page is the list and
 * its pages. Any failed
 * read is the route's error: `listEvents` is no search.
 */

const WHAT = "the events";
const ALL_EVENTS = "/events";

export const headers = catalogueHeaders;

type EventsData = {
  readonly state: EventQueryState;
  readonly canonical: string;
  readonly list: EventList;
};

export async function loader({
  url,
  context,
}: LoaderFunctionArgs): Promise<EventsData> {
  const { state, canonical } = eventQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const pageHref = (page: number) => eventQuery.href(state, { page });
  const result = await listEvents(context, eventQuery.toApi(state));
  if (!result.ok) throwPageFailure(result.failure);
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  return { state, canonical, list: result.data };
}

/** "Events", with ", page 2". */
function listTitle(state: EventQueryState): string {
  return state.page > 1 ? `Events, page ${state.page}` : "Events";
}

export const meta: MetaFunction = args => {
  if (args.error) {
    return failureMeta(args.error, WHAT);
  }
  const loaded = args.loaderData as EventsData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: listTitle(loaded.state),
    description:
      "The events where the pieces of the Bardic Torch catalogue were performed and recorded.",
    path: `${ALL_EVENTS}${loaded.canonical}`,
  });
};

function NoEvents() {
  return (
    <EmptyState title="No events yet">
      The catalogue has no events in it yet.
    </EmptyState>
  );
}

export default function EventsRoute() {
  const { state, canonical, list } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const headingId = useId();
  const resultsRef = useResultsFocus(canonical);
  const busy =
    navigation.state === "loading" &&
    navigation.location.pathname === ALL_EVENTS;
  return (
    <>
      <h1 className="text-h1 text-fg">Events</h1>
      <p className="mt-2">
        <Link to="/events/new" appearance="standalone">
          Add an event
        </Link>
      </p>
      <div className="mt-4">
        <ViewTabs
          views={[{ label: "Read", to: ALL_EVENTS, icon: IconBook2 }]}
          current={ALL_EVENTS}
          meta={formatCount(list.total, "event", "events")}
        />
      </div>
      <div className="mt-6 grid gap-6">
        <section aria-labelledby={headingId} aria-busy={busy || undefined}>
          <h2
            ref={resultsRef}
            id={headingId}
            tabIndex={-1}
            className="text-h3 text-fg focus-visible:outline-hidden"
          >
            All events
          </h2>
          <ResultsStatus visible={list.total > 0}>
            {list.total > 0
              ? showingText(
                  state.page,
                  list.data.length,
                  list.total,
                  "event",
                  "events"
                )
              : "No results"}
          </ResultsStatus>
          {list.data.length > 0 ? (
            <ul role="list" className="mt-2">
              {list.data.map(event => (
                <li
                  key={event.slug}
                  className="border-b border-border py-3 text-body-lg last:border-b-0"
                >
                  <Link to={`/events/${event.slug}`} compact>
                    {event.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <NoEvents />
          )}
          <div className="mt-6">
            <ListPagination
              page={state.page}
              total={list.total}
              href={page => eventQuery.href(state, { page })}
            />
          </div>
        </section>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
