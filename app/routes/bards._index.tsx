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
import { BardFilters } from "~/components/catalogue/BardFilters";
import { BardSearch } from "~/components/catalogue/BardSearch";
import { KeptFocus } from "~/components/catalogue/KeptFocus";
import {
  CatalogueError,
  FilterError,
  failureTitle,
} from "~/components/catalogue/CatalogueError";
import { LetterBar } from "~/components/catalogue/LetterBar";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { PersonListItem } from "~/components/catalogue/PersonListItem";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { SelectedFilters } from "~/components/facets/SelectedFilters";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { ViewTabs } from "~/components/ui/Tabs";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  isBeyondApi,
  redirectPastTheEnd,
  showingText,
} from "~/catalogue/paging";
import {
  personQuery,
  redirectIfNotCanonical,
  type PersonQueryState,
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
  letterLabel,
  PERSON_KIND_LABELS,
  PERSON_ROLE_LABELS,
} from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { useResultsFocus } from "~/hooks/useResultsFocus";
import type { PersonList, TermList } from "~/schemas/catalogue";
import { listPersons, listTerms } from "~/server/catalogue.server";

/**
 * `/bards`: every person and group by name, the A–Z, the search and the
 * filters (plan §4.7), on `/pieces`' pattern (`pieces._index.tsx`): the URL
 * is the state (`personQuery`), a URL that means something else is one 301
 * and a page past the data one 302. The affiliation terms (for the select)
 * load alongside the list; if they fail the select is a SectionError and
 * the list still shows. An affiliation the API no longer knows is left
 * out with one re-query, and the page says so.
 */

const WHAT = "the bards";

const ALL_BARDS = "/bards";

export const headers = catalogueHeaders;

type Affiliations = TermList["data"];

type BardsData = {
  readonly state: PersonQueryState;
  readonly canonical: string;
  /** The affiliation terms in tree order; null when they couldn't load. */
  readonly affiliations: Affiliations | null;
} & (
  | {
      readonly failure: null;
      readonly list: PersonList;
      /** The affiliation asked for no longer exists and was left out. */
      readonly staleAffiliation: boolean;
    }
  | {
      readonly failure: FilterFailure;
      readonly list: null;
      readonly staleAffiliation: false;
    }
);

export async function loader({ url, context }: LoaderFunctionArgs) {
  const asked = personQuery.parse(url.searchParams);
  const { canonical } = asked;
  redirectIfNotCanonical(url, canonical, personQuery.blankable);

  // The terms fill the select, and tell a stale affiliation from another
  // refusal; asked for alongside the list, so the common case is one
  // round trip.
  const termsRead = listTerms(context, { facet: "affiliation" });
  const affiliationsData = async () => {
    const terms = await termsRead;
    return terms.ok ? terms.data.data : null;
  };

  /**
   * The persons for `state` (only the total with `totalOnly`). An
   * affiliation the API no longer knows makes it answer 400: with the
   * terms at hand, it is left out and the list asked for once more (§2.4),
   * and the cleaned state is what the page shows and links from.
   */
  async function readPersons(state: PersonQueryState, totalOnly = false) {
    const query = (from: PersonQueryState) =>
      totalOnly
        ? { ...personQuery.toApi({ ...from, page: 1 }), limit: 1 }
        : personQuery.toApi(from);
    const first = await listPersons(context, query(state));
    const unchanged = { state, staleAffiliation: false, result: first };
    if (
      first.ok ||
      first.failure.kind !== "invalid_filters" ||
      state.affiliation === undefined
    ) {
      return unchanged;
    }
    const affiliations = await affiliationsData();
    if (
      affiliations === null ||
      affiliations.some(term => term.slug === state.affiliation)
    ) {
      return unchanged;
    }
    const cleaned: PersonQueryState = { ...state, affiliation: undefined };
    return {
      state: cleaned,
      staleAffiliation: true,
      result: await listPersons(context, query(cleaned)),
    };
  }

  const failed = (
    failure: ReadFailure,
    page: Omit<BardsData, "failure" | "list" | "staleAffiliation">
  ) => {
    if (isPageFailure(failure)) throwPageFailure(failure);
    const answer: BardsData = {
      ...page,
      failure,
      list: null,
      staleAffiliation: false,
    };
    return data(answer, failureInit(failure));
  };
  // A past-the-end page goes to the last page of the URL asked for, stale
  // affiliation and all, so the page it lands on still says it was left
  // out.
  const pageHref = (page: number) => personQuery.href(asked.state, { page });

  if (isBeyondApi(asked.state.page)) {
    // An offset the API would refuse: ask for the total, then go to the
    // last page there is.
    const head = await readPersons(asked.state, true);
    if (!head.result.ok) {
      return failed(head.result.failure, {
        state: head.state,
        canonical,
        affiliations: await affiliationsData(),
      });
    }
    redirectPastTheEnd(asked.state.page, head.result.data.total, pageHref);
  }

  const { state, staleAffiliation, result } = await readPersons(asked.state);
  const page = { state, canonical, affiliations: await affiliationsData() };
  if (!result.ok) return failed(result.failure, page);
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  const answer: BardsData = {
    ...page,
    failure: null,
    list: result.data,
    staleAffiliation,
  };
  return answer;
}

function isFiltered(state: PersonQueryState): boolean {
  return (
    state.q !== undefined ||
    state.kind.length > 0 ||
    state.role.length > 0 ||
    state.affiliation !== undefined
  );
}

function listTitle(state: PersonQueryState): string {
  const narrowed =
    state.q !== undefined
      ? `Bards matching ‘${state.q}’`
      : state.letter !== undefined
        ? `Bards under ${letterLabel(state.letter)}`
        : "Bards";
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
  // The loader's answer: an error, if any, is handled above.
  const loaded = args.loaderData as BardsData | undefined;
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
      "Every bard in the Bardic Torch catalogue by name: community bards, historical figures and groups, with their works and performances.",
    path: `${ALL_BARDS}${loaded.canonical}`,
    // Searches and filters make endless combinations: only the A–Z pages
    // are indexed, each naming itself as canonical.
    robots:
      isFiltered(loaded.state) || loaded.state.sort || loaded.staleAffiliation
        ? "noindex, follow"
        : undefined,
  });
};

/** One chip per selected value, each linking to the list without it. */
function filterChips(
  state: PersonQueryState,
  affiliations: Affiliations | null
) {
  const affiliationName =
    affiliations?.find(term => term.slug === state.affiliation)?.display_name ??
    state.affiliation;
  return [
    ...(state.q === undefined
      ? []
      : [
          {
            label: `Search: ‘${state.q}’`,
            href: personQuery.href(state, { q: undefined }),
          },
        ]),
    ...state.kind.map(kind => ({
      label: `Kind: ${PERSON_KIND_LABELS[kind]}`,
      href: personQuery.href(state, {
        kind: state.kind.filter(other => other !== kind),
      }),
    })),
    ...state.role.map(role => ({
      label: `Role: ${PERSON_ROLE_LABELS[role]}`,
      href: personQuery.href(state, {
        role: state.role.filter(other => other !== role),
      }),
    })),
    ...(state.affiliation === undefined
      ? []
      : [
          {
            label: `Affiliation: ${affiliationName}`,
            href: personQuery.href(state, { affiliation: undefined }),
          },
        ]),
    ...(state.letter === undefined
      ? []
      : [
          {
            label: `Letter: ${letterLabel(state.letter)}`,
            href: personQuery.href(state, { letter: undefined }),
          },
        ]),
  ];
}

function resultsHeading(state: PersonQueryState): string {
  if (state.q !== undefined) return `Results for ‘${state.q}’`;
  if (state.letter !== undefined) {
    return `Bards under ${letterLabel(state.letter)}`;
  }
  return isFiltered(state) ? "Matching bards" : "All bards";
}

function NoResults({ state }: { readonly state: PersonQueryState }) {
  if (state.q !== undefined) {
    return (
      <EmptyState
        title={`Nothing matches ‘${state.q}’`}
        action={
          <ButtonLink to={personQuery.href(state, { q: undefined })}>
            Clear search
          </ButtonLink>
        }
      >
        Try a shorter search.
      </EmptyState>
    );
  }
  if (isFiltered(state) || state.letter !== undefined) {
    return (
      <EmptyState
        title="No bards match these filters"
        action={<ButtonLink to={ALL_BARDS}>Clear all filters</ButtonLink>}
      >
        Try removing a filter.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No bards yet">
      The catalogue has no bards in it yet.
    </EmptyState>
  );
}

export default function BardsRoute() {
  const loaded = useLoaderData<typeof loader>();
  const { state, affiliations } = loaded;
  const navigation = useNavigation();
  const headingId = useId();
  // The filter control focused last, kept across the remount each change
  // of URL causes.
  const focusRef = useRef<string | null>(null);
  const resultsRef = useResultsFocus(loaded.canonical);
  const busy =
    navigation.state === "loading" &&
    navigation.location.pathname === ALL_BARDS;
  const chips = filterChips(state, affiliations);

  if (loaded.failure) {
    return (
      <FilterError failure={loaded.failure} clearHref={ALL_BARDS}>
        <BardSearch state={state} />
        <SelectedFilters chips={chips} clearHref={ALL_BARDS} />
      </FilterError>
    );
  }

  const { list } = loaded;
  return (
    <>
      <h1 className="text-h1 text-fg">Bards</h1>
      <div className="mt-4">
        <ViewTabs
          views={[{ label: "Read", to: ALL_BARDS, icon: IconBook2 }]}
          current={ALL_BARDS}
          meta={formatCount(list.total, "bard")}
        />
      </div>
      <div className="mt-6 grid gap-6">
        <BardSearch state={state} />
        <LetterBar
          label="Bards by letter"
          letters={list.letters}
          current={state.letter}
          href={letter => personQuery.href(state, { letter })}
        />
        <SelectedFilters chips={chips} clearHref={ALL_BARDS} />
        {loaded.staleAffiliation ? (
          <Alert tone="info">
            That affiliation no longer exists, so we left it out.
          </Alert>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-3 xl:gap-8">
          <section
            aria-labelledby={headingId}
            aria-busy={busy || undefined}
            className="xl:col-span-2"
          >
            <h2
              ref={resultsRef}
              id={headingId}
              tabIndex={-1}
              className="text-h3 text-fg focus-visible:outline-hidden"
            >
              {resultsHeading(state)}
            </h2>
            {/* The stale-affiliation notice is said here too: the Alert
                above isn't a live region, and this is the one status. */}
            <ResultsStatus
              visible={list.total > 0}
              note={
                loaded.staleAffiliation
                  ? "That affiliation no longer exists, so we left it out."
                  : undefined
              }
            >
              {list.total > 0
                ? showingText(state.page, list.data.length, list.total, "bard")
                : state.q === undefined
                  ? "No bards match these filters"
                  : "No results"}
            </ResultsStatus>
            {list.data.length > 0 ? (
              <ul role="list" className="mt-2">
                {list.data.map(person => (
                  <PersonListItem key={person.slug} person={person} />
                ))}
              </ul>
            ) : (
              <NoResults state={state} />
            )}
            <div className="mt-6">
              <ListPagination
                page={state.page}
                total={list.total}
                href={page => personQuery.href(state, { page })}
                narrowable={isFiltered(state)}
              />
            </div>
          </section>
          <div id="filters">
            <KeptFocus key={loaded.canonical} focusRef={focusRef}>
              <BardFilters state={state} affiliations={affiliations} />
            </KeptFocus>
          </div>
        </div>
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
