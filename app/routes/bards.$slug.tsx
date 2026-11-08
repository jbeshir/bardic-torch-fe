import {
  Outlet,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ServerError } from "~/components/ErrorPages";
import type { PersonView } from "~/components/person/PersonPage";
import { failureMeta, ignoreSearchChanges } from "~/catalogue/entity-route";
import { catalogueHeaders } from "~/catalogue/headers";
import { personSubtitle } from "~/catalogue/person";
import {
  NOT_FOUND,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { withoutRestrictedRecording } from "~/catalogue/restricted";
import { pageMeta } from "~/catalogue/seo";
import { personStructuredData } from "~/catalogue/structured-data";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Person } from "~/schemas/catalogue";
import { getPerson } from "~/server/catalogue.server";
import { renderMarkdown } from "~/server/markdown.server";

/**
 * `/bards/:slug`, a person or a group (plan §4.6): the layout of their
 * views, Read (`bards.$slug._index.tsx`) and History, loading the
 * person once for both. A slug that can't be one is our own 404 without
 * asking the API; a failed read is thrown to the ErrorBoundary below.
 */

const WHAT = "this bard";
const MISSING = "that bard";

export const headers = catalogueHeaders;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  if (!isSlug(slug)) throwPageFailure(NOT_FOUND);
  const result = await getPerson(context, slug);
  if (!result.ok) throwPageFailure(result.failure);
  // A restricted piece's recording is emptied here, so its address never
  // reaches the page, not even in the data it hydrates from (§4.0).
  const person: Person = {
    ...result.data,
    profile:
      result.data.profile === null
        ? null
        : {
            ...result.data.profile,
            performances: result.data.profile.performances.map(
              withoutRestrictedRecording
            ),
          },
  };
  // The Markdown is parsed here, on the server: the browser gets the trees.
  const view: PersonView = {
    person,
    markdown: {
      notes: renderMarkdown(person.profile?.notes_md ?? null),
      licensingNotes: renderMarkdown(
        person.profile?.licensing_notes_md ?? null
      ),
    },
  };
  return view;
}

/** Only a new address loads it again, not a new history page. */
export const shouldRevalidate = ignoreSearchChanges;

export const meta: MetaFunction = args => {
  // The loader's answer: an error, if any, is handled first.
  const loaded = args.loaderData as PersonView | undefined;
  if (args.error || !loaded) return failureMeta(args.error, WHAT, MISSING);
  const { person } = loaded;
  // A person who asked not to have a page is kept out of search results,
  // with nothing for a crawler to follow or describe.
  const noPage = person.profile === null;
  return pageMeta(args, {
    title: person.name,
    description: noPage
      ? `${person.name} has asked not to have a page in the Bardic Torch catalogue.`
      : `${person.name}: ${personSubtitle(person).toLowerCase()} in the Bardic Torch catalogue, with their works, performances and links.`,
    path: `/bards/${person.slug}`,
    type: "profile",
    robots: noPage ? "noindex, nofollow" : undefined,
    structuredData: noPage ? undefined : personStructuredData(person),
  });
};

export default function BardLayout() {
  const view = useLoaderData<typeof loader>();
  return <Outlet context={view} />;
}

/**
 * The person couldn't be shown: not found, an outage (the resting page,
 * 503), a server error or an answer we couldn't read, inside the shell.
 * Anything else is a bug, reported and shown as "We couldn’t load this
 * bard".
 */
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
