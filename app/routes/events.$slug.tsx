import {
  Outlet,
  useLoaderData,
  useLocation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { EntityPage } from "~/components/EntityPage";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { LicenceLine } from "~/components/catalogue/LicenceLine";
import { catalogueHeaders } from "~/catalogue/headers";
import { throwPageFailure, thrownPageFailure } from "~/catalogue/read-failure";
import { withoutRestrictedRecording } from "~/catalogue/restricted";
import { failureMeta, ignoreSearchChanges } from "~/catalogue/entity-route";
import { pageMeta } from "~/catalogue/seo";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Event } from "~/schemas/catalogue";
import { getEvent } from "~/server/catalogue.server";
import { hasPendingRevision } from "~/server/editing.server";

/**
 * `/events/:slug`, the layout of an event's page (plan §1, §4.10): one
 * `getEvent` read for the head (breadcrumbs, the h1, the Read and History tabs), and on Read the licence line and the body
 * (`events.$slug._index.tsx`, from this route's data). A restricted
 * piece's recording is emptied here, so its address never reaches the
 * page (§4.0).
 */

const WHAT = "this event";
const MISSING = "that event";

export const headers = catalogueHeaders;

export const shouldRevalidate = ignoreSearchChanges;

export async function loader(args: LoaderFunctionArgs) {
  const { params, context } = args;
  const slug = params.slug ?? "";
  if (!isSlug(slug)) throwPageFailure({ kind: "not_found" });
  const [result, pending] = await Promise.all([
    getEvent(context, slug),
    hasPendingRevision(args, "event", slug),
  ]);
  if (!result.ok) throwPageFailure(result.failure);
  const event: Event = {
    ...result.data,
    performances: result.data.performances.map(withoutRestrictedRecording),
  };
  return { event, pending };
}

export const meta: MetaFunction = args => {
  if (args.error) return failureMeta(args.error, WHAT, MISSING);
  // The loader's answer: an error, if any, is handled above.
  const event = (args.loaderData as { readonly event: Event } | undefined)
    ?.event;
  if (!event) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: event.name,
    description: `${event.name}, an event in the Bardic Torch catalogue, and the performances recorded there.`,
    path: `/events/${event.slug}`,
  });
};

export default function EventLayout() {
  const { event, pending } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const path = `/events/${event.slug}`;
  return (
    <EntityPage
      path={path}
      pending={pending}
      title={event.name}
      breadcrumbs={{
        trail: [{ label: "Events", to: "/events" }],
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
    <CatalogueError failure={failure} missing={MISSING} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
