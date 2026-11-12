import {
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ServerError } from "~/components/ErrorPages";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { failureMeta } from "~/catalogue/entity-route";
import { formatCount } from "~/catalogue/format";
import { catalogueHeaders } from "~/catalogue/headers";
import { redirectPastTheEnd } from "~/catalogue/paging";
import { historyQuery } from "~/catalogue/query-state";
import { throwPageFailure, thrownPageFailure } from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { CONTRIBUTE_HREF, NEEDS_WORK_PATH } from "~/constants/navigation";
import { NEEDS_WORK_LABELS } from "~/constants/vocabulary";
import { readPath } from "~/editing/editor-data";
import { useErrorReference } from "~/hooks/useErrorReference";
import type { NeedsWorkReason } from "~/schemas/catalogue";
import { listNeedsWork } from "~/server/catalogue.server";

/**
 * /needs-work (R-18): the public pieces and bards a contributor could
 * improve, pieces first, 50 a page, all of them or for one reason
 * (`?reason=`), with how many there are for each.
 */

const WHAT = "the pages that need work";

export const headers = catalogueHeaders;

const REASONS = Object.keys(NEEDS_WORK_LABELS) as NeedsWorkReason[];

/** The page's address for a reason (or all) and page. */
function needsWorkHref(reason: NeedsWorkReason | null, page: number) {
  const query = new URLSearchParams([
    ...(reason ? [["reason", reason]] : []),
    ...(page > 1 ? [["page", String(page)]] : []),
  ]).toString();
  return query === "" ? NEEDS_WORK_PATH : `${NEEDS_WORK_PATH}?${query}`;
}

export async function loader({ url, context }: LoaderFunctionArgs) {
  const asked = url.searchParams.get("reason");
  const reason = REASONS.find(r => r === asked) ?? null;
  const { state } = historyQuery.parse(url.searchParams);
  const result = await listNeedsWork(context, {
    ...(reason ? { reason } : {}),
    ...historyQuery.toApi(state),
  });
  if (!result.ok) throwPageFailure(result.failure);
  redirectPastTheEnd(state.page, result.data.total, page =>
    needsWorkHref(reason, page)
  );
  return { reason, page: state.page, list: result.data };
}

export const meta: MetaFunction = args => {
  if (args.error) return failureMeta(args.error, WHAT);
  return pageMeta(args, {
    title: "Needs work",
    description:
      "Pieces and bards in the Bardic Torch catalogue that a contributor could improve: stubs, unassessed pieces, unknown licensing and broken links.",
    path: NEEDS_WORK_PATH,
  });
};

export default function NeedsWorkRoute() {
  const { reason, page, list } = useLoaderData<typeof loader>();
  return (
    <>
      <h1 className="text-h1 text-fg">Needs work</h1>
      <p className="mt-2 max-w-prose text-body text-fg">
        Pages a contributor could improve: stubs to fill in, pieces whose
        conservation status nobody has assessed, licensing nobody has found yet,
        and links that no longer work. Pick one and edit it.{" "}
        <Link to={CONTRIBUTE_HREF} appearance="prose">
          How to contribute
        </Link>
      </p>
      <nav aria-label="Reasons" className="mt-6">
        <TagList
          size="sm"
          tags={[
            {
              label: "Any reason",
              to: needsWorkHref(null, 1),
              current: reason === null,
            },
            ...list.counts.map(({ reason: each, count }) => ({
              label: `${NEEDS_WORK_LABELS[each]} (${count})`,
              to: needsWorkHref(each, 1),
              current: reason === each,
            })),
          ]}
        />
      </nav>
      <p className="mt-4 text-body-sm text-fg-muted">
        {formatCount(list.total, "page", "pages")}
      </p>
      {list.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing needs work here">
            {reason === null
              ? "Every page is in good shape."
              : "Every page is in good shape for this reason."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul role="list" className="mt-2">
            {list.data.map(entry => (
              <li
                key={`${entry.entity_type}:${entry.slug}`}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-border py-3 last:border-b-0"
              >
                <span className="text-body-lg">
                  <Link to={readPath(entry.entity_type, entry.slug)} compact>
                    {entry.title}
                  </Link>
                </span>
                <span className="text-body-sm text-fg-muted">
                  {entry.entity_type === "piece" ? "Piece" : "Bard"}
                  {" · "}
                  {entry.reasons.map(r => NEEDS_WORK_LABELS[r]).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <ListPagination
              page={page}
              total={list.total}
              href={n => needsWorkHref(reason, n)}
            />
          </div>
        </>
      )}
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} missing={WHAT} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
