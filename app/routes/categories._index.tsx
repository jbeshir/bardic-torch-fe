import { IconBook2 } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import {
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  CatalogueError,
  failureTitle,
} from "~/components/catalogue/CatalogueError";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { TermTree } from "~/components/TermTree";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { SectionError } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { ViewTabs } from "~/components/ui/Tabs";
import { TagList } from "~/components/ui/TagList";
import { formatCount, formatNumber } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  categoryIndexQuery,
  pieceQuery,
  redirectIfNotCanonical,
  type CategoryFacet,
  type CategoryIndexQueryState,
} from "~/catalogue/query-state";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { buildTermIndex } from "~/catalogue/term-index";
import {
  CONSERVATION_STATUSES,
  FACET_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import {
  facetSchema,
  type ConservationStatus,
  type PieceList,
  type TermList,
} from "~/schemas/catalogue";
import { listPieces, listTerms } from "~/server/catalogue.server";

/**
 * `/categories`: every category by facet (plan §4.8), each facet's terms
 * as a tree linking to their pages, plus two sections the API keeps as
 * piece fields rather than terms: the kinds and the conservation statuses,
 * each linking to the pieces with it. `?facet=` shows one section alone
 * (the sidebar's facet links); its two piece-field values are never sent
 * to `listTerms`, which doesn't know them.
 *
 * The term tree is the page: its failure is the route's error. The kind
 * and status counts are a region of the full index: if they fail, a
 * SectionError stands in for them and the tree still shows. Alone
 * (`?facet=kind`), they are the page again.
 */

const WHAT = "the categories";
const ALL_CATEGORIES = "/categories";

export const headers = catalogueHeaders;

/** The facet counts the kind and status sections show. */
type PieceCounts = Pick<PieceList["facets"], "kinds" | "conservation_statuses">;

type CategoriesData = {
  readonly state: CategoryIndexQueryState;
  readonly canonical: string;
  /** The terms shown, or null when the page shows no term facet. */
  readonly terms: TermList | null;
  /**
   * The kind and status counts: null when the page doesn't show them, or
   * (on the full index only) "failed" when they couldn't be loaded.
   */
  readonly counts: PieceCounts | "failed" | null;
};

/** Whether `facet` is a term facet, the only kind `listTerms` takes. */
function isTermFacet(
  facet: CategoryFacet | undefined
): facet is (typeof facetSchema.options)[number] {
  return facet !== undefined && facet !== "kind" && facet !== "conservation";
}

export async function loader({
  url,
  context,
}: LoaderFunctionArgs): Promise<CategoriesData> {
  const { state, canonical } = categoryIndexQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const { facet } = state;
  const showsTerms = facet === undefined || isTermFacet(facet);
  const showsCounts = !isTermFacet(facet);

  const [terms, pieces] = await Promise.all([
    showsTerms
      ? listTerms(context, isTermFacet(facet) ? { facet } : {})
      : undefined,
    showsCounts ? listPieces(context, { limit: 1 }) : undefined,
  ]);
  if (terms && !terms.ok) throwPageFailure(asPageFailure(terms.failure));
  if (pieces && !pieces.ok && facet !== undefined) {
    throwPageFailure(asPageFailure(pieces.failure));
  }
  return {
    state,
    canonical,
    terms: terms?.data ?? null,
    counts:
      pieces === undefined
        ? null
        : pieces.ok
          ? {
              kinds: pieces.data.facets.kinds,
              conservation_statuses: pieces.data.facets.conservation_statuses,
            }
          : "failed",
  };
}

/** A section's heading: a facet's label, or the two piece fields'. */
function sectionLabel(facet: CategoryFacet): string {
  switch (facet) {
    case "kind":
      return "Kind";
    case "conservation":
      return "Conservation status";
    default:
      return FACET_LABELS[facet];
  }
}

export const meta: MetaFunction = args => {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      { title: `${failureTitle(thrown, WHAT)} · Bardic Torch` },
      { name: "robots", content: "noindex" },
    ];
  }
  const loaded = args.loaderData as CategoriesData | undefined;
  if (!loaded) return [...SERVER_ERROR_META];
  const { facet } = loaded.state;
  return pageMeta(args, {
    title:
      facet === undefined
        ? "Categories"
        : `${sectionLabel(facet)} · Categories`,
    description:
      facet === undefined
        ? "Every category in the Bardic Torch catalogue: moods, topics, cultures, languages, legendaria, forms, origins and affiliations, with how many pieces each has."
        : `The ${sectionLabel(facet).toLowerCase()} categories of the Bardic Torch catalogue, with how many pieces each has.`,
    path: `${ALL_CATEGORIES}${loaded.canonical}`,
  });
};

/** `/pieces` with only `change` set. */
const NO_PIECE_FILTERS = pieceQuery.parse(new URLSearchParams()).state;

/** "Browse endangered pieces": each status as the end of that sentence. */
const BROWSE_STATUS: Readonly<Record<ConservationStatus, string>> = {
  low_risk: "Browse low-risk pieces",
  endangered: "Browse endangered pieces",
  critically_endangered: "Browse critically endangered pieces",
  restricted: "Browse restricted pieces",
  unassessed: "Browse pieces not yet assessed",
};

/** A link with its count after it: "(31)", read "31 pieces". */
function Counted({
  count,
  children,
}: {
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-6 flex-wrap items-baseline gap-x-1.5">
      {children}
      <span className="text-body-sm text-fg-subtle">
        <span aria-hidden="true">({formatNumber(count)})</span>
        <span className="sr-only">{formatCount(count, "piece")}</span>
      </span>
    </span>
  );
}

function KindSection({ counts }: { readonly counts: PieceCounts }) {
  if (counts.kinds.length === 0) return <Empty />;
  return (
    <ul role="list" className="grid gap-1">
      {counts.kinds.map(({ kind, count }) => (
        <li key={kind}>
          <Counted count={count}>
            <Link
              to={pieceQuery.href(NO_PIECE_FILTERS, { kind: [kind] })}
              compact
            >
              {PIECE_KIND_LABELS[kind]}
            </Link>
          </Counted>
        </li>
      ))}
    </ul>
  );
}

function ConservationSection({ counts }: { readonly counts: PieceCounts }) {
  const byStatus = new Map(
    counts.conservation_statuses.map(
      ({ conservation_status, count }) => [conservation_status, count] as const
    )
  );
  return (
    <ul role="list" className="grid gap-3">
      {CONSERVATION_STATUSES.map(status => (
        <li
          key={status}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <ConservationBadge status={status} size="sm" named />
          <Counted count={byStatus.get(status) ?? 0}>
            <Link
              to={pieceQuery.href(NO_PIECE_FILTERS, { status: [status] })}
              compact
            >
              {BROWSE_STATUS[status]}
            </Link>
          </Counted>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-body-sm text-fg-subtle">No categories here yet.</p>;
}

/** One section of the index: an h2 (or none, alone) and its body. */
function Section({
  label,
  alone,
  children,
}: {
  readonly label: string;
  /** The page shows this section only, under its own h1. */
  readonly alone: boolean;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  if (alone) return <div className="mt-6">{children}</div>;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="mb-3 text-h3 text-fg">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** The sections a page shows, in the index's order. */
const SECTIONS: readonly CategoryFacet[] = [
  "kind",
  ...facetSchema.options,
  "conservation",
];

export default function CategoriesRoute() {
  const { state, terms, counts } = useLoaderData<typeof loader>();
  const index = terms ? buildTermIndex(terms.data) : null;
  const shown =
    state.facet === undefined
      ? SECTIONS
      : SECTIONS.filter(facet => facet === state.facet);
  const title =
    state.facet === undefined ? "Categories" : sectionLabel(state.facet);
  const alone = state.facet !== undefined;
  const countsFailed = counts === "failed";

  return (
    <>
      {state.facet === undefined ? null : (
        <div className="mb-2">
          <Breadcrumbs
            trail={[{ label: "Categories", to: ALL_CATEGORIES }]}
            current={title}
          />
        </div>
      )}
      <h1 className="text-h1 text-fg">{title}</h1>
      <div className="mt-4">
        <ViewTabs
          views={[
            {
              label: "Read",
              to: categoryIndexQuery.href(state.facet),
              icon: IconBook2,
            },
          ]}
          current={categoryIndexQuery.href(state.facet)}
          meta={
            terms && state.facet !== undefined
              ? formatCount(terms.data.length, "category", "categories")
              : undefined
          }
        />
      </div>
      <nav aria-label="Category sections" className="mt-6">
        <TagList
          size="sm"
          tags={[
            {
              label: "All categories",
              to: ALL_CATEGORIES,
              current: state.facet === undefined,
            },
            ...SECTIONS.map(facet => ({
              label: sectionLabel(facet),
              to: categoryIndexQuery.href(facet),
              current: state.facet === facet,
            })),
          ]}
        />
      </nav>
      {countsFailed ? (
        <div className="mt-8">
          <SectionError title="We couldn’t load the kinds and conservation statuses">
            The categories below are all here.
          </SectionError>
        </div>
      ) : null}
      {shown.map(facet => {
        if (facet === "kind" || facet === "conservation") {
          if (counts === null || counts === "failed") return null;
          return (
            <Section key={facet} label={sectionLabel(facet)} alone={alone}>
              {facet === "kind" ? (
                <KindSection counts={counts} />
              ) : (
                <ConservationSection counts={counts} />
              )}
            </Section>
          );
        }
        const facetTerms = index?.byFacet.get(facet) ?? [];
        return (
          <Section key={facet} label={sectionLabel(facet)} alone={alone}>
            {facetTerms.length > 0 ? (
              <TermTree terms={facetTerms} />
            ) : (
              <Empty />
            )}
          </Section>
        );
      })}
    </>
  );
}

/**
 * The page couldn't load: an outage (the resting page, 503), a server
 * error or an answer we couldn't read, inside the shell.
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
