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
import { PersonListItem } from "~/components/catalogue/PersonListItem";
import { PieceListItem } from "~/components/catalogue/PieceListItem";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { UnderPageHead } from "~/components/ui/ErrorState";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { catalogueHeaders } from "~/catalogue/headers";
import { isBeyondApi, redirectPastTheEnd } from "~/catalogue/paging";
import {
  redirectIfNotCanonical,
  termMembersQuery,
  type PageQueryState,
} from "~/catalogue/query-state";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import {
  categoryMeta,
  categoryPath,
  memberCount,
  memberTotal,
} from "~/catalogue/term-page";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Term } from "~/schemas/catalogue";
import { getTerm } from "~/server/catalogue.server";

/**
 * `/categories/:slug` (Read): a page of the category's members, 50 at a
 * time by `?page` (plan §4.8): its pieces, or for an affiliation its bards,
 * by sort title or name. The layout above has the head; this loader reads
 * only the members, so paging reloads it alone. The total is the term's
 * `piece_count` (or `person_count`), and paging past it is one 302.
 */

const WHAT = "the members of this category";

export const headers = catalogueHeaders;

type MembersData = {
  readonly state: PageQueryState;
  readonly canonical: string;
  readonly term: Term;
};

export async function loader({
  params,
  url,
  context,
}: LoaderFunctionArgs): Promise<MembersData> {
  const slug = params.slug ?? "";
  // The layout answers the 404; this read must not reach the API either.
  if (!isSlug(slug)) throwPageFailure({ kind: "not_found" });
  const { state, canonical } = termMembersQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const pageHref = (page: number) =>
    termMembersQuery.href(categoryPath(slug), page);

  if (isBeyondApi(state.page)) {
    const first = await getTerm(context, slug, { limit: 1 });
    if (!first.ok) throwPageFailure(asPageFailure(first.failure));
    redirectPastTheEnd(state.page, memberTotal(first.data), pageHref);
  }
  const result = await getTerm(context, slug, termMembersQuery.toApi(state));
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  redirectPastTheEnd(state.page, memberTotal(result.data), pageHref);
  return { state, canonical, term: result.data };
}

export const meta: MetaFunction = args => {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      {
        title: `${failureTitle(thrown, WHAT, "that category")} · Bardic Torch`,
      },
      { name: "robots", content: "noindex" },
    ];
  }
  // The loader's answer: an error, if any, is handled above.
  const loaded = args.loaderData as MembersData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  const { term, state } = loaded;
  return pageMeta(args, {
    title:
      state.page > 1
        ? `${term.display_name}, page ${state.page}`
        : term.display_name,
    description: `${categoryMeta(term)} in the Bardic Torch catalogue, the community’s record of bardic songs, poems, stories and music.`,
    path: `${categoryPath(term.slug)}${loaded.canonical}`,
  });
};

function Members({ term }: { readonly term: Term }) {
  if (term.facet === "affiliation") {
    return term.persons.map(person => (
      <PersonListItem key={person.slug} person={person} />
    ));
  }
  return term.pieces.map(piece => (
    <PieceListItem key={piece.slug} piece={piece} />
  ));
}

function NoMembers({ term }: { readonly term: Term }) {
  return term.facet === "affiliation" ? (
    <EmptyState
      title="Nothing here yet"
      action={<ButtonLink to="/bards">Browse bards</ButtonLink>}
    >
      No bards are in this affiliation yet.
    </EmptyState>
  ) : (
    <EmptyState
      title="Nothing here yet"
      action={<ButtonLink to="/pieces">Browse pieces</ButtonLink>}
    >
      No pieces are in this category yet.
    </EmptyState>
  );
}

export default function CategoryMembersRoute() {
  const { state, term } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const headingId = useId();
  const path = categoryPath(term.slug);
  const total = memberTotal(term);
  const affiliation = term.facet === "affiliation";
  // A members page loading keeps the old rows, marked busy meanwhile.
  const busy =
    navigation.state === "loading" && navigation.location.pathname === path;
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      className="not-prose mt-8"
    >
      <h2 id={headingId} className="text-h3 text-fg">
        {affiliation ? "Bards" : "Pieces"}
      </h2>
      {total > 0 ? (
        <>
          <p className="mt-1 flex flex-wrap gap-x-3 text-body-sm text-fg-muted">
            <span>{memberCount(term)}</span>
            <Link
              to={
                affiliation
                  ? `/bards?affiliation=${term.slug}`
                  : `/pieces?term=${term.slug}`
              }
              compact
            >
              {affiliation ? "Search these bards" : "Filter these pieces"}
            </Link>
          </p>
          <ul role="list" className="mt-2 flow-root">
            <Members term={term} />
          </ul>
          <div className="mt-6">
            <ListPagination
              page={state.page}
              total={total}
              href={page => termMembersQuery.href(path, page)}
            />
          </div>
        </>
      ) : (
        <NoMembers term={term} />
      )}
    </section>
  );
}

/**
 * The members couldn't load, under the category's head: an outage, a
 * server error or an answer we couldn't read (the term itself loaded, so
 * a 404 here is the term vanishing between the two reads).
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return (
    <UnderPageHead>
      {failure ? (
        <CatalogueError failure={failure} what={WHAT} missing="that category" />
      ) : (
        <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
      )}
    </UnderPageHead>
  );
}
