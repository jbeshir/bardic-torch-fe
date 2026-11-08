import { IconBook2 } from "@tabler/icons-react";
import { useId, useRef } from "react";
import {
  data,
  useLoaderData,
  useNavigation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  CatalogueError,
  FilterError,
  failureTitle,
} from "~/components/catalogue/CatalogueError";
import { CollectionKindFilter } from "~/components/catalogue/CollectionKindFilter";
import { KeptFocus } from "~/components/catalogue/KeptFocus";
import { LetterBar } from "~/components/catalogue/LetterBar";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { UserLink } from "~/components/catalogue/UserLink";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { SelectedFilters } from "~/components/facets/SelectedFilters";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { ViewTabs } from "~/components/ui/Tabs";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  isBeyondApi,
  redirectPastTheEnd,
  showingText,
} from "~/catalogue/paging";
import {
  collectionQuery,
  redirectIfNotCanonical,
  type CollectionQueryState,
} from "~/catalogue/query-state";
import {
  failureInit,
  isPageFailure,
  throwPageFailure,
  thrownPageFailure,
  type FilterFailure,
  type ReadFailure,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { COLLECTION_KIND_LABELS, letterLabel } from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { useResultsFocus } from "~/hooks/useResultsFocus";
import type { CollectionList, CollectionSummary } from "~/schemas/catalogue";
import { listCollections } from "~/server/catalogue.server";

/**
 * `/collections`: the songbooks, playlists, sites and archives pieces are
 * found in (plan §4.9), by sort name (the API's order, a leading "The" ignored),
 * with the A–Z and a kind filter. The URL is the state (`collectionQuery`).
 * A kind filter's 500 may be a search too slow, and its 400 a kind the API
 * refused: both are shown by the page with the filter kept; any other
 * failure is the route's error.
 */

const WHAT = "the collections";
const ALL_COLLECTIONS = "/collections";

export const headers = catalogueHeaders;

type CollectionsData = {
  readonly state: CollectionQueryState;
  readonly canonical: string;
} & (
  | { readonly failure: null; readonly list: CollectionList }
  | { readonly failure: FilterFailure; readonly list: null }
);

function failed(
  failure: ReadFailure,
  state: CollectionQueryState,
  canonical: string
) {
  if (isPageFailure(failure)) throwPageFailure(failure);
  const page: CollectionsData = { state, canonical, failure, list: null };
  return data(page, failureInit(failure));
}

export async function loader({ url, context }: LoaderFunctionArgs) {
  const { state, canonical } = collectionQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const pageHref = (page: number) => collectionQuery.href(state, { page });

  if (isBeyondApi(state.page)) {
    const first = await listCollections(context, {
      ...collectionQuery.toApi({ ...state, page: 1 }),
      limit: 1,
    });
    if (!first.ok) return failed(first.failure, state, canonical);
    redirectPastTheEnd(state.page, first.data.total, pageHref);
  }
  const result = await listCollections(context, collectionQuery.toApi(state));
  if (!result.ok) return failed(result.failure, state, canonical);
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  const page: CollectionsData = {
    state,
    canonical,
    failure: null,
    list: result.data,
  };
  return page;
}

function listTitle(state: CollectionQueryState): string {
  const narrowed =
    state.letter === undefined
      ? "Collections"
      : `Collections under ${letterLabel(state.letter)}`;
  return state.page > 1 ? `${narrowed}, page ${state.page}` : narrowed;
}

export const meta: MetaFunction = args => {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      { title: `${failureTitle(thrown, WHAT)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  const loaded = args.loaderData as CollectionsData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  if (loaded.failure) {
    return [
      { title: `${failureTitle(loaded.failure, WHAT)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  return pageMeta(args, {
    title: listTitle(loaded.state),
    description:
      "The songbooks, playlists, websites and archives where the pieces of the Bardic Torch catalogue are found.",
    path: `${ALL_COLLECTIONS}${loaded.canonical}`,
    // Kind combinations are endless; the A–Z pages are indexed.
    robots: loaded.state.kind.length > 0 ? "noindex, follow" : undefined,
  });
};

function filterChips(state: CollectionQueryState) {
  return [
    ...state.kind.map(kind => ({
      label: `Kind: ${COLLECTION_KIND_LABELS[kind]}`,
      href: collectionQuery.href(state, {
        kind: state.kind.filter(other => other !== kind),
      }),
    })),
    ...(state.letter === undefined
      ? []
      : [
          {
            label: `Letter: ${letterLabel(state.letter)}`,
            href: collectionQuery.href(state, { letter: undefined }),
          },
        ]),
  ];
}

/** One collection: its page, its kind, whether it's for bards, and where it is. */
function CollectionListItem({
  collection,
}: {
  readonly collection: CollectionSummary;
}) {
  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <div className="text-body-lg">
        <Link to={`/collections/${collection.id}`} compact>
          {collection.name}
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
        <span>{COLLECTION_KIND_LABELS[collection.kind]}</span>
        {collection.is_bardic_resource ? (
          <span className="inline-flex items-center gap-1 text-caption">
            <IconBook2 size={16} stroke={1.75} aria-hidden="true" />
            Made for bards
          </span>
        ) : null}
        {collection.url === null ? null : (
          <UserLink url={collection.url}>
            Visit<span className="sr-only"> {collection.name}</span>
          </UserLink>
        )}
      </div>
    </li>
  );
}

export default function CollectionsRoute() {
  const loaded = useLoaderData<typeof loader>();
  const { state, canonical } = loaded;
  const navigation = useNavigation();
  const headingId = useId();
  // The filter control focused last, kept across the remount each change
  // of URL causes.
  const focusRef = useRef<string | null>(null);
  const resultsRef = useResultsFocus(canonical);
  const busy =
    navigation.state === "loading" &&
    navigation.location.pathname === ALL_COLLECTIONS;
  const chips = (
    <SelectedFilters chips={filterChips(state)} clearHref={ALL_COLLECTIONS} />
  );
  const filter = (
    <KeptFocus key={canonical} focusRef={focusRef}>
      <CollectionKindFilter state={state} />
    </KeptFocus>
  );

  if (loaded.failure) {
    return (
      <FilterError failure={loaded.failure} clearHref={ALL_COLLECTIONS}>
        {chips}
        {filter}
      </FilterError>
    );
  }
  const { list } = loaded;
  const filtered = state.kind.length > 0 || state.letter !== undefined;
  return (
    <>
      <h1 className="text-h1 text-fg">Collections</h1>
      <div className="mt-4">
        <ViewTabs
          views={[{ label: "Read", to: ALL_COLLECTIONS, icon: IconBook2 }]}
          current={ALL_COLLECTIONS}
          meta={formatCount(list.total, "collection")}
        />
      </div>
      <div className="mt-6 grid gap-6">
        <LetterBar
          label="Collections by letter"
          letters={list.letters}
          current={state.letter}
          href={letter => collectionQuery.href(state, { letter })}
        />
        {chips}
        <section aria-labelledby={headingId} aria-busy={busy || undefined}>
          <h2
            ref={resultsRef}
            id={headingId}
            tabIndex={-1}
            className="text-h3 text-fg focus-visible:outline-hidden"
          >
            {state.letter === undefined
              ? filtered
                ? "Matching collections"
                : "All collections"
              : `Collections under ${letterLabel(state.letter)}`}
          </h2>
          <ResultsStatus>
            {list.total > 0
              ? showingText(
                  state.page,
                  list.data.length,
                  list.total,
                  "collection"
                )
              : "No collections match these filters"}
          </ResultsStatus>
          {list.data.length > 0 ? (
            <ul role="list" className="mt-2">
              {list.data.map(collection => (
                <CollectionListItem
                  key={collection.id}
                  collection={collection}
                />
              ))}
            </ul>
          ) : filtered ? (
            <EmptyState
              title="No collections match these filters"
              action={
                <ButtonLink to={ALL_COLLECTIONS}>Clear all filters</ButtonLink>
              }
            >
              Try another letter or kind.
            </EmptyState>
          ) : (
            <EmptyState title="No collections yet">
              The catalogue has no collections in it yet.
            </EmptyState>
          )}
          <div className="mt-6">
            <ListPagination
              page={state.page}
              total={list.total}
              href={page => collectionQuery.href(state, { page })}
            />
          </div>
        </section>
        {filter}
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
