import {
  Outlet,
  useLoaderData,
  useLocation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  CatalogueError,
  failureTitle,
} from "~/components/catalogue/CatalogueError";
import { EntityPage } from "~/components/EntityPage";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { LicenceLine } from "~/components/LicenceLine";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { linkExposure } from "~/catalogue/restricted";
import { ignoreSearchChanges } from "~/catalogue/revalidate";
import { pageMeta } from "~/catalogue/seo";
import { EVENT_KIND_LABELS } from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Event, EventPerformance } from "~/schemas/catalogue";
import { getEvent } from "~/server/catalogue.server";

/**
 * `/events/:slug`, the layout of an event's or venue's page (plan §1,
 * §4.10): one `getEvent` read for the head (breadcrumbs, the h1, the kind,
 * the Read and History tabs), and on Read the licence line and the body
 * (`events.$slug._index.tsx`, from this route's data). A restricted
 * piece's recording is emptied here, so its address never reaches the
 * page (§4.0).
 */

const WHAT = "this event";
const MISSING = "that event or venue";

export const headers = catalogueHeaders;

export const shouldRevalidate = ignoreSearchChanges;

/** A performance without its recording when its piece is restricted. */
function withoutRestrictedRecording(
  performance: EventPerformance
): EventPerformance {
  return linkExposure(performance.piece) === "internal-only"
    ? { ...performance, link: { url: "", title: null, platform: null } }
    : performance;
}

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  if (!isSlug(slug)) throwPageFailure({ kind: "not_found" });
  const result = await getEvent(context, slug);
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  const event: Event = {
    ...result.data,
    performances: result.data.performances.map(withoutRestrictedRecording),
  };
  return { event };
}

export const meta: MetaFunction = args => {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      { title: `${failureTitle(thrown, WHAT, MISSING)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  // The loader's answer: an error, if any, is handled above.
  const event = (args.loaderData as { readonly event: Event } | undefined)
    ?.event;
  if (!event) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: event.name,
    description: `${event.name}, ${event.kind === "venue" ? "a venue" : "an event"} in the Bardic Torch catalogue, and the performances recorded there.`,
    path: `/events/${event.slug}`,
  });
};

export default function EventLayout() {
  const { event } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const path = `/events/${event.slug}`;
  return (
    <EntityPage
      path={path}
      title={event.name}
      subtitle={EVENT_KIND_LABELS[event.kind]}
      breadcrumbs={{
        trail: [{ label: "Events and venues", to: "/events" }],
        current: event.name,
      }}
      {...(pathname === path
        ? { licence: <LicenceLine historyPath={`${path}/history`} /> }
        : {})}
    >
      <Outlet />
    </EntityPage>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} what={WHAT} missing={MISSING} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
