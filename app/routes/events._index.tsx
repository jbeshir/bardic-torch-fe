import { IconBook2 } from "@tabler/icons-react";
import { useId } from "react";
import {
  useLoaderData,
  useNavigation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  CatalogueError,
  failureTitle,
} from "~/components/catalogue/CatalogueError";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { ViewTabs } from "~/components/ui/Tabs";
import { TagList } from "~/components/ui/TagList";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  isBeyondApi,
  redirectPastTheEnd,
  showingText,
} from "~/catalogue/paging";
import {
  eventQuery,
  redirectIfNotCanonical,
  type EventQueryState,
} from "~/catalogue/query-state";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { EVENT_KIND_LABELS } from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { useResultsFocus } from "~/hooks/useResultsFocus";
import type { EventList } from "~/schemas/catalogue";
import { listEvents } from "~/server/catalogue.server";

/**
 * `/events`: the events and venues pieces were performed at (plan §4.10),
 * by name, all of them or one kind. The API has no A–Z and no search for
 * them, so the page is the list, its kind switch and its pages. Any failed
 * read is the route's error: `listEvents` is no search.
 */

const WHAT = "the events and venues";
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
  if (isBeyondApi(state.page)) {
    const first = await listEvents(context, {
      ...eventQuery.toApi({ ...state, page: 1 }),
      limit: 1,
    });
    if (!first.ok) throwPageFailure(asPageFailure(first.failure));
    redirectPastTheEnd(state.page, first.data.total, pageHref);
  }
  const result = await listEvents(context, eventQuery.toApi(state));
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  return { state, canonical, list: result.data };
}

/** "Events and venues", "Venues", "Events", with ", page 2". */
function listTitle(state: EventQueryState): string {
  const title =
    state.kind === "venue"
      ? "Venues"
      : state.kind === "event"
        ? "Events"
        : "Events and venues";
  return state.page > 1 ? `${title}, page ${state.page}` : title;
}

export const meta: MetaFunction = args => {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      { title: `${failureTitle(thrown, WHAT)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  const loaded = args.loaderData as EventsData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: listTitle(loaded.state),
    description:
      "The events and venues where the pieces of the Bardic Torch catalogue were performed and recorded.",
    path: `${ALL_EVENTS}${loaded.canonical}`,
  });
};

function NoEvents({ state }: { readonly state: EventQueryState }) {
  if (state.kind === undefined) {
    return (
      <EmptyState title="No events or venues yet">
        The catalogue has no events or venues in it yet.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      title={
        state.kind === "venue"
          ? "No venues recorded yet"
          : "No events recorded yet"
      }
      action={
        <ButtonLink to={ALL_EVENTS}>Show all events and venues</ButtonLink>
      }
    >
      Try the other kind, or all of them.
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
      <h1 className="text-h1 text-fg">Events and venues</h1>
      <div className="mt-4">
        <ViewTabs
          views={[{ label: "Read", to: ALL_EVENTS, icon: IconBook2 }]}
          current={ALL_EVENTS}
          meta={formatCount(list.total, "event or venue", "events and venues")}
        />
      </div>
      <div className="mt-6 grid gap-6">
        <nav aria-label="Kinds">
          <TagList
            size="sm"
            tags={[
              {
                label: "All",
                to: eventQuery.href(state, { kind: undefined }),
                current: state.kind === undefined,
              },
              {
                label: "Events",
                to: eventQuery.href(state, { kind: "event" }),
                current: state.kind === "event",
              },
              {
                label: "Venues",
                to: eventQuery.href(state, { kind: "venue" }),
                current: state.kind === "venue",
              },
            ]}
          />
        </nav>
        <section aria-labelledby={headingId} aria-busy={busy || undefined}>
          <h2
            ref={resultsRef}
            id={headingId}
            tabIndex={-1}
            className="text-h3 text-fg focus-visible:outline-hidden"
          >
            {state.kind === "venue"
              ? "Venues"
              : state.kind === "event"
                ? "Events"
                : "All events and venues"}
          </h2>
          <ResultsStatus>
            {list.total > 0
              ? showingText(
                  state.page,
                  list.data.length,
                  list.total,
                  "event or venue",
                  "events and venues"
                )
              : "No results"}
          </ResultsStatus>
          {list.data.length > 0 ? (
            <ul role="list" className="mt-2">
              {list.data.map(event => (
                <li
                  key={event.slug}
                  className="flex flex-wrap items-baseline gap-x-3 border-b border-border py-3 last:border-b-0"
                >
                  <span className="text-body-lg">
                    <Link to={`/events/${event.slug}`} compact>
                      {event.name}
                    </Link>
                  </span>
                  <span className="text-body-sm text-fg-muted">
                    {EVENT_KIND_LABELS[event.kind]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <NoEvents state={state} />
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
    <CatalogueError failure={failure} what={WHAT} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
