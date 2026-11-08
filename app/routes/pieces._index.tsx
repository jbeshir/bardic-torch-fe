import { IconBook2, IconFilter } from "@tabler/icons-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
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
import { FacetDrawer } from "~/components/facets/FacetDrawer";
import { FacetForm } from "~/components/facets/FacetForm";
import { SelectedFilters } from "~/components/facets/SelectedFilters";
import { Alert } from "~/components/ui/Alert";
import { Button, ButtonLink } from "~/components/ui/Button";
import { SectionError } from "~/components/ui/ErrorState";
import { EmptyState } from "~/components/ui/EmptyState";
import { ViewTabs } from "~/components/ui/Tabs";
import { facetGroups, termChipLabel } from "~/catalogue/facet-groups";
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
import {
  buildTermIndex,
  isPieceTerm,
  type TermIndex,
} from "~/catalogue/term-index";
import {
  CONSERVATION_LABELS,
  letterLabel,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { PieceList, TermListItem } from "~/schemas/catalogue";
import { useErrorReference } from "~/hooks/useErrorReference";
import { useHydrated } from "~/hooks/useHydrated";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { listPieces, listTerms } from "~/server/catalogue.server";

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
  /** The canonical query string of the URL asked for, for the canonical link. */
  readonly canonical: string;
  /** Every term, for the facets' names and tree; null if they failed. */
  readonly terms: readonly TermListItem[] | null;
  /** The URL's `term`s that are no categories any more, left out (§2.4). */
  readonly stale: readonly string[];
} & (
  | { readonly failure: null; readonly list: PieceList }
  | { readonly failure: FilterFailure; readonly list: null }
);

function failed(
  failure: ReadFailure,
  page: Omit<PiecesData, "failure" | "list">
) {
  if (isPageFailure(failure)) throwPageFailure(failure);
  const answer: PiecesData = { ...page, failure, list: null };
  return data(answer, failureInit(failure));
}

export async function loader({ url, context }: LoaderFunctionArgs) {
  const asked = pieceQuery.parse(url.searchParams);
  const { canonical } = asked;
  redirectIfNotCanonical(url, canonical, pieceQuery.blankable);

  // The terms name the facets; asked for alongside the pieces, so the
  // common case is one round trip.
  const termsRead = listTerms(context);
  const termsData = async () => {
    const terms = await termsRead;
    return terms.ok ? terms.data.data : null;
  };

  /**
   * The pieces for `state` (only the total with `totalOnly`). A `term` the
   * API doesn't know (deleted, unapproved or an affiliation) makes it
   * answer 400: with the terms at hand, those slugs are left out and the
   * list asked for once more (§2.4).
   */
  async function readPieces(state: PieceQueryState, totalOnly = false) {
    const query = (from: PieceQueryState) =>
      totalOnly
        ? { ...pieceQuery.toApi({ ...from, page: 1 }), limit: 1 }
        : pieceQuery.toApi(from);
    const first = await listPieces(context, query(state));
    const unchanged = { state, stale: [], result: first } as const;
    if (first.ok || first.failure.kind !== "invalid_filters") return unchanged;
    const terms = await termsRead;
    if (!terms.ok) return unchanged;
    const index = buildTermIndex(terms.data.data);
    const stale = state.term.filter(slug => !isPieceTerm(index, slug));
    if (stale.length === 0) return unchanged;
    const cleaned: PieceQueryState = {
      ...state,
      term: state.term.filter(slug => isPieceTerm(index, slug)),
    };
    return {
      state: cleaned,
      stale,
      result: await listPieces(context, query(cleaned)),
    };
  }

  if (isBeyondApi(asked.state.page)) {
    // An offset the API would refuse: ask for the total, then go to the
    // last page there is.
    const head = await readPieces(asked.state, true);
    if (!head.result.ok) {
      return failed(head.result.failure, {
        state: head.state,
        canonical,
        terms: await termsData(),
        stale: head.stale,
      });
    }
    const { total } = head.result.data;
    redirectPastTheEnd(asked.state.page, total, page =>
      pieceQuery.href(head.state, { page })
    );
  }

  const { state, stale, result } = await readPieces(asked.state);
  const page = { state, canonical, terms: await termsData(), stale };
  if (!result.ok) return failed(result.failure, page);
  redirectPastTheEnd(state.page, result.data.total, n =>
    pieceQuery.href(state, { page: n })
  );
  const answer: PiecesData = { ...page, failure: null, list: result.data };
  return answer;
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
    // pages are indexed; each names itself as canonical (a link with
    // stale categories too: never a canonical elsewhere with noindex).
    robots:
      isFiltered(loaded.state) || loaded.state.sort || loaded.stale.length > 0
        ? "noindex, follow"
        : undefined,
  });
};

type Chip = { readonly label: string; readonly href: string };

/**
 * One chip per selected value (plan §2.3), each linking to the list
 * without it: the search, each category, kind and status, the page state
 * and the letter. A category is named by the terms, or by its slug when
 * they couldn't be loaded.
 */
function filterChips(
  state: PieceQueryState,
  index: TermIndex | null
): readonly Chip[] {
  const without = (change: Partial<PieceQueryState>) =>
    pieceQuery.href(state, change);
  return [
    ...(state.q === undefined
      ? []
      : [{ label: `Search: ‘${state.q}’`, href: without({ q: undefined }) }]),
    ...state.term.map(slug => ({
      label: termChipLabel(index, slug),
      href: without({ term: state.term.filter(other => other !== slug) }),
    })),
    ...state.kind.map(kind => ({
      label: `Kind: ${PIECE_KIND_LABELS[kind]}`,
      href: without({ kind: state.kind.filter(other => other !== kind) }),
    })),
    ...state.status.map(status => ({
      label: `Conservation: ${CONSERVATION_LABELS[status]}`,
      href: without({
        status: state.status.filter(other => other !== status),
      }),
    })),
    ...(state.stub === undefined
      ? []
      : [
          {
            label: state.stub ? "Stubs only" : "Hiding stubs",
            href: without({ stub: undefined }),
          },
        ]),
    ...(state.letter === undefined
      ? []
      : [
          {
            label: `Letter: ${letterLabel(state.letter)}`,
            href: without({ letter: undefined }),
          },
        ]),
  ];
}

/** How many filter values are ticked: the "Filters (2 selected)" count. */
function selectedCount(state: PieceQueryState): number {
  return (
    state.term.length +
    state.kind.length +
    state.status.length +
    (state.stub === undefined ? 0 : 1)
  );
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

/** "‘a’, ‘b’": the reader's own slugs, quoted. */
function quotedList(slugs: readonly string[]): string {
  return slugs.map(slug => `‘${slug}’`).join(", ");
}

/** The breakpoint where the facet column sits beside the results. */
const XL_QUERY = "(min-width: 1280px)";

/** The facet column's section, the skip link's and the Filters link's target. */
const FILTERS_ID = "filters";

export default function PiecesRoute() {
  const loaded = useLoaderData<typeof loader>();
  const { state, canonical } = loaded;
  const navigation = useNavigation();
  const headingId = useId();
  const filtersHeadingId = useId();
  const formId = useId();
  const focusRef = useRef<string | null>(null);
  const wide = useMediaQuery(XL_QUERY);
  // Below xl with JS the filters are the drawer's, and only the drawer's:
  // one form at a time, so its ids stay unique.
  const inDrawer = useHydrated() && !wide;
  const drawerId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const index = useMemo(
    () => (loaded.terms ? buildTermIndex(loaded.terms) : null),
    [loaded.terms]
  );
  const chips = filterChips(state, index);
  // Same-route navigations (a letter, a page, a filter) keep the old
  // results until the new ones are in, marked busy meanwhile.
  const busy =
    navigation.state === "loading" &&
    navigation.location.pathname === ALL_PIECES;

  if (loaded.failure) {
    return (
      <FilterError failure={loaded.failure} clearHref={ALL_PIECES}>
        <PieceSearch state={state} />
        <SelectedFilters chips={chips} clearHref={ALL_PIECES} />
        {loaded.terms ? null : (
          <SectionError title="We couldn’t load the categories" />
        )}
      </FilterError>
    );
  }

  const { list } = loaded;
  const selected = selectedCount(state);
  const filtersLabel =
    selected > 0 ? `Filters (${selected} selected)` : "Filters";
  // The facet form, the same wherever it is shown (keyed on the URL).
  const form = {
    id: formId,
    state,
    groups: facetGroups(index, list.facets, state),
    termsFailed: index === null,
    focusRef,
  };
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
      {/* One DOM order at every width: the results, then the filters,
          which the grid lifts into the left column from xl. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-browse xl:gap-x-8">
        <div className="grid min-w-0 content-start gap-6 xl:col-start-2 xl:row-start-1">
          <a
            href={`#${FILTERS_ID}`}
            className="sr-only rounded-sm text-body-sm font-medium text-link focus:not-sr-only focus:justify-self-start max-xl:hidden"
          >
            Skip to filters
          </a>
          <PieceSearch state={state} />
          <LetterBar
            label="Pieces by letter"
            letters={list.facets.letters}
            current={state.letter}
            href={letter => pieceQuery.href(state, { letter })}
          />
          {state.q === undefined ? null : (
            <PieceSort key={canonical} state={state} form={formId} />
          )}
          <SelectedFilters chips={chips} clearHref={ALL_PIECES} />
          <div className="xl:hidden">
            {inDrawer ? (
              <Button
                icon={IconFilter}
                aria-haspopup="dialog"
                aria-controls={drawerId}
                onClick={openDrawer}
              >
                {filtersLabel}
              </Button>
            ) : (
              <ButtonLink to={`#${FILTERS_ID}`} icon={IconFilter}>
                {filtersLabel}
              </ButtonLink>
            )}
          </div>
          {loaded.stale.length > 0 ? (
            <Alert tone="info">
              {`Some categories in this link no longer exist, so we left them out: ${quotedList(loaded.stale)}.`}
            </Alert>
          ) : null}
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
        {inDrawer ? null : (
          <section
            id={FILTERS_ID}
            aria-labelledby={filtersHeadingId}
            className="min-w-0 border-t border-border pt-6 xl:col-start-1 xl:row-start-1 xl:border-t-0 xl:pt-0"
          >
            <h2 id={filtersHeadingId} className="text-h3 text-fg">
              Filters
            </h2>
            <div className="mt-4">
              <FacetForm key={canonical} {...form} autoSubmit={wide} apply />
            </div>
          </section>
        )}
      </div>
      {inDrawer ? (
        <FacetDrawer
          id={drawerId}
          open={drawerOpen}
          onClose={closeDrawer}
          form={formId}
          clearHref={pieceQuery.href(state, {
            term: [],
            kind: [],
            status: [],
            stub: undefined,
          })}
        >
          <FacetForm
            key={canonical}
            {...form}
            autoSubmit={false}
            apply={false}
          />
        </FacetDrawer>
      ) : null}
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
