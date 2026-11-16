import { data, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { RowTable } from "~/components/catalogue/RowTable";
import { ModerationNav } from "~/components/moderation/ModerationNav";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { formatDate } from "~/catalogue/format";
import { redirectPastTheEnd } from "~/catalogue/paging";
import { historyQuery } from "~/catalogue/query-state";
import { MODERATION_PATH, reviewPath } from "~/constants/moderation";
import { revisionEntity } from "~/editing/revision-entity";
import { isEntityId } from "~/schemas/address";
import { listModerationQueue } from "~/server/api.server";
import { redirectSignedOut } from "~/server/moderation.server";

/**
 * /moderation, the queue: the pending revisions, oldest first, 50 a page,
 * each with a link to its review. `?approved=` and `?rejected=` (where the
 * review page leaves to) say what just happened.
 */

export const meta = () => [
  { title: "Moderation queue · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const { state } = historyQuery.parse(url.searchParams);
  const { limit, offset } = historyQuery.toApi(state);
  const result = await listModerationQueue(
    request,
    context,
    new URLSearchParams({ limit: String(limit), offset: String(offset) })
  );
  redirectSignedOut(result, url);
  const noted = (name: string) => {
    const id = url.searchParams.get(name) ?? "";
    return isEntityId(id) ? id : null;
  };
  const notes = { approved: noted("approved"), rejected: noted("rejected") };
  if (!result.ok) {
    return data(
      { ...notes, page: state.page, list: null, error: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  redirectPastTheEnd(state.page, result.data.total, page =>
    historyQuery.href(MODERATION_PATH, page)
  );
  return data(
    { ...notes, page: state.page, list: result.data, error: null },
    { headers: result.headers }
  );
}

export default function ModerationQueueRoute() {
  const { approved, rejected, page, list, error } =
    useLoaderData<typeof loader>();
  return (
    <>
      <h1 className="text-h1 text-fg">Moderation queue</h1>
      <ModerationNav />
      <div className="mt-6 grid gap-4">
        {approved ? (
          <Alert tone="success" title={`Revision ${approved} is approved.`} />
        ) : null}
        {rejected ? (
          <Alert tone="success" title={`Revision ${rejected} is rejected.`}>
            Its author will see your note in their contributions.
          </Alert>
        ) : null}
        {error === null ? null : (
          <Alert
            tone="danger"
            title="We couldn’t load the queue."
            actions={
              <ButtonLink to={MODERATION_PATH} reloadDocument>
                Try again
              </ButtonLink>
            }
          >
            {error}
          </Alert>
        )}
      </div>
      {list === null ? null : list.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing is waiting for review">
            Edits that contributors send in are listed here, oldest first.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6">
          <RowTable
            label="Edits waiting for review, oldest first"
            rows={list.data}
            rowKey={revision => String(revision.id)}
            columns={[
              {
                header: "Page",
                cell: revision => {
                  const { name, noun } = revisionEntity(revision);
                  return (
                    <>
                      {name}
                      <span className="text-fg-muted"> ({noun})</span>
                    </>
                  );
                },
              },
              {
                header: "Author",
                cell: revision => revision.author?.display_name ?? "Unknown",
              },
              {
                header: "Summary",
                cell: revision =>
                  revision.summary === "" ? (
                    <span className="text-fg-subtle">No summary</span>
                  ) : (
                    revision.summary
                  ),
              },
              {
                header: "Sent",
                nowrap: true,
                cell: revision => (
                  <time dateTime={revision.created_at}>
                    {formatDate(revision.created_at)}
                  </time>
                ),
              },
              {
                header: "Review",
                cell: revision => (
                  <div className="flex flex-wrap items-center gap-2">
                    <ButtonLink to={reviewPath(revision.id)} size="sm">
                      Review
                      <span className="sr-only">
                        {" "}
                        revision {revision.id} of{" "}
                        {revisionEntity(revision).name}
                      </span>
                    </ButtonLink>
                    {revision.is_stale ? (
                      <span className="rounded-sm border border-warning-border bg-warning-bg px-1.5 text-caption font-medium text-warning-fg">
                        Page changed since
                      </span>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <div className="mt-6">
            <ListPagination
              page={page}
              total={list.total}
              href={n => historyQuery.href(MODERATION_PATH, n)}
            />
          </div>
        </div>
      )}
    </>
  );
}
