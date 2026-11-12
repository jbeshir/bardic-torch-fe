import { failureMeta } from "~/catalogue/entity-route";
import {
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { PersonListItem } from "~/components/catalogue/PersonListItem";
import { PieceListItem } from "~/components/catalogue/PieceListItem";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { SearchBox } from "~/components/SearchBox";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { SectionError } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { formatCount, formatNumber } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  pieceQuery,
  redirectIfNotCanonical,
  searchQuery,
} from "~/catalogue/query-state";
import {
  throwPageFailure,
  thrownPageFailure,
  TRY_AGAIN,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { searchTerms, type TermMatches } from "~/catalogue/term-search";
import { FACET_LABELS } from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import type { PersonList, PieceList } from "~/schemas/catalogue";
import { listPersons, listPieces, listTerms } from "~/server/catalogue.server";

/**
 * `/search?q=`: the catalogue-wide search (plan §4.4), the header's and
 * the home page's search box's target. Three sections read in parallel:
 * the top 10 pieces, the top 10 bards, and the categories (every term,
 * matched here: `listTerms` has no `q`). Each section fails on its own;
 * only when all three fail is the page an error (503 if all are outages,
 * otherwise 500). No `q`, no API call: only the search box.
 */

const WHAT = "the search results";

/** How many pieces and bards each section shows. */
const TOP = 10;

export const headers = catalogueHeaders;

type Section<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false };

type SearchData =
  | { readonly q: undefined }
  | {
      readonly q: string;
      readonly pieces: Section<PieceList>;
      readonly persons: Section<PersonList>;
      readonly terms: Section<TermMatches>;
    };

export async function loader({ url, context }: LoaderFunctionArgs) {
  const { state, canonical } = searchQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const { q } = state;
  if (q === undefined) {
    const empty: SearchData = { q };
    return empty;
  }

  const [pieces, persons, terms] = await Promise.all([
    listPieces(context, { q, limit: TOP }),
    listPersons(context, { q, limit: TOP }),
    listTerms(context, {}),
  ]);
  if (!pieces.ok && !persons.ok && !terms.ok) {
    throwPageFailure(TRY_AGAIN);
  }
  const answer: SearchData = {
    q,
    pieces,
    persons,
    terms: terms.ok
      ? { ok: true, data: searchTerms(terms.data.data, q) }
      : terms,
  };
  return answer;
}

export const meta: MetaFunction = args => {
  if (args.error) {
    return failureMeta(args.error, WHAT);
  }
  const loaded = args.loaderData as SearchData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: loaded.q === undefined ? "Search" : `Search: ${loaded.q}`,
    description:
      "Search the Bardic Torch catalogue: pieces, bards and the categories they are filed under.",
    path: searchQuery.href({ q: loaded.q }),
    // Endless searches: followed, never indexed.
    robots: "noindex, follow",
  });
};

/** A section that failed to load (plan §4.4). */
function SectionFailure({ what }: { readonly what: string }) {
  return (
    <SectionError title={`We couldn’t load the ${what}`}>
      The catalogue is briefly out of reach. Try again in a few minutes.
    </SectionError>
  );
}

function ResultsSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 id={headingId} className="text-h3 text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "See all 31 pieces": the full list, when there are more than shown. */
function SeeAll({
  to,
  total,
  noun,
}: {
  readonly to: string;
  readonly total: number;
  readonly noun: string;
}) {
  if (total <= TOP) return null;
  return (
    <p className="mt-2 text-body">
      <Link to={to}>See all {formatCount(total, noun)}</Link>
    </p>
  );
}

/** "12 pieces, 3 bards and 1 category match ‘kettle’", from the sections read. */
function statusText(loaded: Extract<SearchData, { q: string }>): string {
  const counts = [
    loaded.pieces.ok ? formatCount(loaded.pieces.data.total, "piece") : null,
    loaded.persons.ok ? formatCount(loaded.persons.data.total, "bard") : null,
    loaded.terms.ok
      ? formatCount(loaded.terms.data.total, "category", "categories")
      : null,
  ].filter(count => count !== null);
  const found =
    (loaded.pieces.ok ? loaded.pieces.data.total : 0) +
    (loaded.persons.ok ? loaded.persons.data.total : 0) +
    (loaded.terms.ok ? loaded.terms.data.total : 0);
  if (found === 0) return "No results";
  const list =
    counts.length > 1
      ? `${counts.slice(0, -1).join(", ")} and ${counts.at(-1)}`
      : (counts[0] ?? "");
  return `${list} match ‘${loaded.q}’`;
}

export default function SearchRoute() {
  const loaded = useLoaderData<typeof loader>();
  // The box stays mounted across searches, so the box or button just used
  // keeps focus (WCAG 2.4.3); a search made elsewhere (the header's box,
  // Back) shows its words here, unless the reader is typing in it.
  const boxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (box && document.activeElement !== box) box.value = loaded.q ?? "";
  }, [loaded.q]);
  // The status is always there, empty before a search, so the first
  // search's count is announced as a change (a live region added already
  // filled often isn't).
  const head = (
    <>
      <h1 className="text-h1 text-fg">Search</h1>
      <div className="mt-6 max-w-form">
        <SearchBox
          ref={boxRef}
          size="lg"
          defaultValue={loaded.q}
          label="Search the catalogue"
        />
      </div>
      <ResultsStatus>
        {loaded.q === undefined ? "" : statusText(loaded)}
      </ResultsStatus>
    </>
  );
  if (loaded.q === undefined) {
    return (
      <>
        {head}
        <p className="mt-4 text-body text-fg-muted">
          Type a word from a title, a name or a category.
        </p>
      </>
    );
  }

  const { q, pieces, persons, terms } = loaded;
  const nothing =
    pieces.ok &&
    persons.ok &&
    terms.ok &&
    pieces.data.total + persons.data.total + terms.data.total === 0;
  return (
    <>
      {head}
      {nothing ? (
        <EmptyState
          title={`Nothing matches ‘${q}’`}
          action={<ButtonLink to="/pieces">Browse pieces</ButtonLink>}
        >
          Try a shorter search, or browse by mood or topic.
        </EmptyState>
      ) : (
        <div className="mt-8 grid gap-10">
          <ResultsSection title="Pieces">
            {pieces.ok ? (
              pieces.data.total > 0 ? (
                <>
                  <ul role="list">
                    {pieces.data.data.map(piece => (
                      <PieceListItem key={piece.slug} piece={piece} />
                    ))}
                  </ul>
                  <SeeAll
                    to={pieceQuery.href(
                      pieceQuery.parse(new URLSearchParams({ q })).state
                    )}
                    total={pieces.data.total}
                    noun="piece"
                  />
                </>
              ) : (
                <p className="text-body text-fg-muted">No pieces match.</p>
              )
            ) : (
              <SectionFailure what="pieces" />
            )}
          </ResultsSection>
          <ResultsSection title="Bards">
            {persons.ok ? (
              persons.data.total > 0 ? (
                <>
                  <ul role="list">
                    {persons.data.data.map(person => (
                      <PersonListItem key={person.slug} person={person} />
                    ))}
                  </ul>
                  <SeeAll
                    to={`/bards?${new URLSearchParams({ q })}`}
                    total={persons.data.total}
                    noun="bard"
                  />
                </>
              ) : (
                <p className="text-body text-fg-muted">No bards match.</p>
              )
            ) : (
              <SectionFailure what="bards" />
            )}
          </ResultsSection>
          <ResultsSection title="Categories">
            {terms.ok ? (
              terms.data.total > 0 ? (
                <>
                  <TagList
                    tags={terms.data.shown.map(term => ({
                      label: term.display_name,
                      prefix: `${FACET_LABELS[term.facet]}:`,
                      to: `/categories/${term.slug}`,
                    }))}
                  />
                  {terms.data.total > terms.data.shown.length ? (
                    <p className="text-caption text-fg-subtle">
                      and{" "}
                      {formatNumber(terms.data.total - terms.data.shown.length)}{" "}
                      more
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-body text-fg-muted">No categories match.</p>
              )
            ) : (
              <SectionFailure what="categories" />
            )}
          </ResultsSection>
        </div>
      )}
    </>
  );
}

/**
 * Every section failed: the resting page (503), inside the shell. Anything else is a bug, reported.
 */
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
