import { IconBook2 } from "@tabler/icons-react";
import { useId } from "react";
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
import { LetterBar } from "~/components/catalogue/LetterBar";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { PieceListItem } from "~/components/catalogue/PieceListItem";
import { PieceSearch, PieceSort } from "~/components/catalogue/PieceSearch";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { SelectedFilters } from "~/components/facets/SelectedFilters";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { ViewTabs } from "~/components/ui/Tabs";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import { isBeyondApi, redirectPastTheEnd } from "~/catalogue/paging";
import {
  pieceQuery,
  redirectIfNotCanonical,
  type PieceQueryState,
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
import { letterLabel } from "~/constants/vocabulary";
import type { PieceList } from "~/schemas/catalogue";
import { useErrorReference } from "~/hooks/useErrorReference";
import { listPieces } from "~/server/catalogue.server";

/**
 * `/pieces`: every piece by title, the A–Z index, and the search and
 * filters over them (plan §4.2). The URL is the state (`pieceQuery`): a
 * URL that means something other than its canonical form is answered with
 * one 301; a page past the data with one 302 to the last page.
 *
 * A failed read is a `ReadFailure`: an outage, a 500 or an unreadable
 * answer is thrown to the ErrorBoundary below (inside the shell); a search
 * too slow or a filter the API refused is returned, so the page keeps its
 * search box and chips to change them.
 */

const WHAT = "the pieces";

/** The URL without any search or filter. */
const ALL_PIECES = "/pieces";

export const headers = catalogueHeaders;

/** What the page renders: the list, or the failure of its filters. */
type PiecesData = {
  readonly state: PieceQueryState;
  /** The canonical query string, for the canonical link. */
  readonly canonical: string;
} & (
  | { readonly failure: null; readonly list: PieceList }
  | { readonly failure: FilterFailure; readonly list: null }
);

function failed(
  failure: ReadFailure,
  state: PieceQueryState,
  canonical: string
) {
  if (isPageFailure(failure)) throwPageFailure(failure);
  const page: PiecesData = { state, canonical, failure, list: null };
  return data(page, failureInit(failure));
}

export async function loader({ url, context }: LoaderFunctionArgs) {
  const { state, canonical } = pieceQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const pageHref = (page: number) => pieceQuery.href(state, { page });

  if (isBeyondApi(state.page)) {
    // An offset the API would refuse: ask for the total, then go to the
    // last page there is.
    const first = await listPieces(context, {
      ...pieceQuery.toApi({ ...state, page: 1 }),
      limit: 1,
    });
    if (!first.ok) return failed(first.failure, state, canonical);
    redirectPastTheEnd(state.page, first.data.total, pageHref);
  }

  const result = await listPieces(context, pieceQuery.toApi(state));
  if (!result.ok) return failed(result.failure, state, canonical);
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  const page: PiecesData = {
    state,
    canonical,
    failure: null,
    list: result.data,
  };
  return page;
}

/** Whether the list is narrowed by more than its letter or page. */
function isFiltered(state: PieceQueryState): boolean {
  return (
    state.q !== undefined ||
    state.term.length > 0 ||
    state.kind.length > 0 ||
    state.status.length > 0 ||
    state.stub !== undefined
  );
}

/** "Pieces", "Pieces under T", "Pieces matching ‘kettle’", ", page 2". */
function listTitle(state: PieceQueryState): string {
  const narrowed =
    state.q !== undefined
      ? `Pieces matching ‘${state.q}’`
      : state.letter !== undefined
        ? `Pieces under ${letterLabel(state.letter)}`
        : "Pieces";
  return state.page > 1 ? `${narrowed}, page ${state.page}` : narrowed;
}

export const meta: MetaFunction = args => {
  if (args.error) {
    // Titled like the boundary's h1: anything unexpected is a server error.
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      { title: `${failureTitle(thrown, WHAT)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  // The loader's answer: an error, if any, is handled above.
  const loaded = args.loaderData as PiecesData | undefined;
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
      "Every piece in the Bardic Torch catalogue by title: songs, poems, stories and music of the bardic community, with how at risk each is of being lost.",
    path: `${ALL_PIECES}${loaded.canonical}`,
    // Searches and filters make endless combinations, so only the A–Z
    // pages are indexed; each names itself as canonical.
    robots:
      isFiltered(loaded.state) || loaded.state.sort
        ? "noindex, follow"
        : undefined,
  });
};

/** One chip per selected value, each linking to the list without it. */
function filterChips(state: PieceQueryState) {
  return [
    ...(state.q === undefined
      ? []
      : [
          {
            label: `Search: ‘${state.q}’`,
            href: pieceQuery.href(state, { q: undefined }),
          },
        ]),
    ...(state.letter === undefined
      ? []
      : [
          {
            label: `Letter: ${letterLabel(state.letter)}`,
            href: pieceQuery.href(state, { letter: undefined }),
          },
        ]),
  ];
}

/** The results' heading: what the list is. */
function resultsHeading(state: PieceQueryState): string {
  if (state.q !== undefined) return `Results for ‘${state.q}’`;
  if (state.letter !== undefined) {
    return `Pieces under ${letterLabel(state.letter)}`;
  }
  return isFiltered(state) ? "Matching pieces" : "All pieces";
}

function NoResults({ state }: { readonly state: PieceQueryState }) {
  if (state.q !== undefined) {
    return (
      <EmptyState
        title={`Nothing matches ‘${state.q}’`}
        action={<ButtonLink to={ALL_PIECES}>Browse pieces</ButtonLink>}
      >
        Try a shorter search, or browse by mood or topic.
      </EmptyState>
    );
  }
  if (isFiltered(state) || state.letter !== undefined) {
    return (
      <EmptyState
        title="No pieces match these filters"
        action={<ButtonLink to={ALL_PIECES}>Clear all filters</ButtonLink>}
      >
        Try removing a filter.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No pieces yet">
      The catalogue has no pieces in it yet.
    </EmptyState>
  );
}

export default function PiecesRoute() {
  const loaded = useLoaderData<typeof loader>();
  const { state } = loaded;
  const navigation = useNavigation();
  const headingId = useId();
  // Same-route navigations (a letter, a page, a search) keep the old
  // results until the new ones are in, marked busy meanwhile.
  const busy =
    navigation.state === "loading" &&
    navigation.location.pathname === ALL_PIECES;
  const controls = (
    <>
      <PieceSearch state={state} />
      <SelectedFilters chips={filterChips(state)} clearHref={ALL_PIECES} />
    </>
  );

  if (loaded.failure) {
    return (
      <FilterError failure={loaded.failure} clearHref={ALL_PIECES}>
        {controls}
      </FilterError>
    );
  }

  const { list } = loaded;
  return (
    <>
      <h1 className="text-h1 text-fg">Pieces</h1>
      <div className="mt-4">
        <ViewTabs
          views={[{ label: "Read", to: ALL_PIECES, icon: IconBook2 }]}
          current={ALL_PIECES}
          meta={formatCount(list.total, "piece")}
        />
      </div>
      <div className="mt-6 grid gap-6">
        <PieceSearch state={state} />
        <LetterBar
          label="Pieces by letter"
          letters={list.facets.letters}
          current={state.letter}
          href={letter => pieceQuery.href(state, { letter })}
        />
        {state.q === undefined ? null : <PieceSort state={state} />}
        <SelectedFilters chips={filterChips(state)} clearHref={ALL_PIECES} />
        <section aria-labelledby={headingId} aria-busy={busy || undefined}>
          <h2 id={headingId} className="text-h3 text-fg">
            {resultsHeading(state)}
          </h2>
          <ResultsStatus>
            {list.total > 0
              ? `Showing ${formatCount(list.total, "piece")}`
              : state.q === undefined
                ? "No pieces match these filters"
                : "No results"}
          </ResultsStatus>
          {list.data.length > 0 ? (
            <ul role="list" className="mt-2">
              {list.data.map(piece => (
                <PieceListItem key={piece.slug} piece={piece} />
              ))}
            </ul>
          ) : (
            <NoResults state={state} />
          )}
          <div className="mt-6">
            <ListPagination
              page={state.page}
              total={list.total}
              href={page => pieceQuery.href(state, { page })}
            />
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * The page couldn't load: an outage (the resting page, 503), a server
 * error or an answer we couldn't read, inside the shell. Anything else is
 * a bug, reported and shown as "We couldn’t load the pieces".
 */
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
