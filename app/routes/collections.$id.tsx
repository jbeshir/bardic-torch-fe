import {
  Outlet,
  useLoaderData,
  useLocation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { UserLink } from "~/components/catalogue/UserLink";
import { EntityPage } from "~/components/EntityPage";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { LicenceLine } from "~/components/catalogue/LicenceLine";
import { Infobox } from "~/components/ui/Infobox";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { withoutRestrictedLink } from "~/catalogue/restricted";
import { failureMeta, ignoreSearchChanges } from "~/catalogue/entity-route";
import { pageMeta } from "~/catalogue/seo";
import { categoryPath } from "~/catalogue/term-page";
import { urlHost } from "~/catalogue/user-url";
import {
  COLLECTION_KIND_LABELS,
  ENUMERABLE_LABELS,
} from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isEntityId } from "~/schemas/address";
import type { Collection } from "~/schemas/catalogue";
import { getCollection } from "~/server/catalogue.server";
import { hasPendingRevision } from "~/server/editing.server";
import { renderMarkdown } from "~/server/markdown.server";

/**
 * `/collections/:id`, the layout of a collection's page (plan §1, §4.9):
 * one `getCollection` read for the head (breadcrumbs with the parent, the
 * h1, the kind and region, the Read and History tabs) and, on Read, the
 * infobox, the licence line and the body (`collections.$id._index.tsx`,
 * from this route's data). History pages never reload it.
 *
 * An id that can't be one (`0`, `01`, `abc`, past int64) is our own 404,
 * without asking the API.
 */

const WHAT = "this collection";
const MISSING = "that collection";

export const headers = catalogueHeaders;

export const shouldRevalidate = ignoreSearchChanges;

export async function loader(args: LoaderFunctionArgs) {
  const { params, context } = args;
  const id = params.id ?? "";
  if (!isEntityId(id)) throwPageFailure({ kind: "not_found" });
  const result = await getCollection(context, id);
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  const collection = result.data;
  return {
    collection: {
      ...collection,
      citations: collection.citations.map(withoutRestrictedLink),
    },
    // The Markdown is parsed here, on the server: the browser gets the tree.
    description: renderMarkdown(collection.description_md),
    pending: await hasPendingRevision(args, "collection", id),
  };
}

/** "Songbook website · Northmarch". */
function collectionMeta(collection: Collection): string {
  return [
    COLLECTION_KIND_LABELS[collection.kind],
    ...(collection.region ? [collection.region.display_name] : []),
  ].join(" · ");
}

export const meta: MetaFunction = args => {
  if (args.error) return failureMeta(args.error, WHAT, MISSING);
  // The loader's answer: an error, if any, is handled above.
  const collection = (
    args.loaderData as { readonly collection: Collection } | undefined
  )?.collection;
  if (!collection) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: collection.name,
    description: `${collection.name}: ${collectionMeta(collection).toLowerCase()}, and the pieces and bards the Bardic Torch catalogue cites from it.`,
    path: `/collections/${collection.id}`,
  });
};

function CollectionInfobox({
  collection,
}: {
  readonly collection: Collection;
}) {
  return (
    <Infobox
      title={collection.name}
      subtitle={COLLECTION_KIND_LABELS[collection.kind]}
      sections={[
        {
          heading: "Details",
          rows: [
            {
              label: "Where",
              value:
                collection.url === null ? null : (
                  <UserLink url={collection.url}>
                    {urlHost(collection.url)}
                  </UserLink>
                ),
            },
            {
              label: "Region",
              value: collection.region ? (
                <TagList
                  size="sm"
                  tags={[
                    {
                      label: collection.region.display_name,
                      to: categoryPath(collection.region.slug),
                    },
                  ]}
                />
              ) : null,
            },
            ...(collection.parent
              ? [
                  {
                    label: "Part of",
                    value: (
                      <Link
                        to={`/collections/${collection.parent.id}`}
                        appearance="prose"
                      >
                        {collection.parent.name}
                      </Link>
                    ),
                  },
                ]
              : []),
            {
              label: "Contents can be listed",
              value: ENUMERABLE_LABELS[collection.enumerable],
            },
            {
              label: "Made for bards",
              value: collection.is_bardic_resource ? "Yes" : "No",
            },
          ],
        },
      ]}
    />
  );
}

export default function CollectionLayout() {
  const { collection, pending } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const path = `/collections/${collection.id}`;
  const reading = pathname === path;
  return (
    <EntityPage
      path={path}
      pending={pending}
      title={collection.name}
      subtitle={collectionMeta(collection)}
      breadcrumbs={{
        trail: [
          { label: "Collections", to: "/collections" },
          ...(collection.parent
            ? [
                {
                  label: collection.parent.name,
                  to: `/collections/${collection.parent.id}`,
                },
              ]
            : []),
        ],
        current: collection.name,
      }}
      {...(reading
        ? {
            infobox: <CollectionInfobox collection={collection} />,
            licence: <LicenceLine historyPath={`${path}/history`} />,
          }
        : {})}
    >
      <Outlet />
    </EntityPage>
  );
}

/**
 * The collection couldn't be shown: not found (404), an outage (503), a
 * server error or an answer we couldn't read, inside the shell.
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
