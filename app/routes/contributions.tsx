import { IconArrowBackUp } from "@tabler/icons-react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { RowTable } from "~/components/catalogue/RowTable";
import { Alert } from "~/components/ui/Alert";
import { Button, ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { formatDate } from "~/catalogue/format";
import { redirectPastTheEnd } from "~/catalogue/paging";
import { historyQuery } from "~/catalogue/query-state";
import { CONTRIBUTIONS_PATH, loginHref } from "~/constants/account";
import { revisionEntity } from "~/editing/revision-entity";
import { isEntityId } from "~/schemas/address";
import type { RevisionListItem } from "~/schemas/api";
import { listMyRevisions, withdrawRevision } from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/**
 * /contributions, "My contributions": the reader's own revisions, newest
 * first, 50 a page. A rejected one shows the moderator's note under its
 * status. A pending one can be continued or withdrawn; Withdraw is a
 * document POST to this route's action. `?submitted=` and
 * `?withdrawn=` (where the editors and the action leave to) say what
 * just happened.
 */

export const meta = () => [
  { title: "My contributions · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

const STATUS_LABELS: Readonly<Record<RevisionListItem["status"], string>> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const { state } = historyQuery.parse(url.searchParams);
  const { limit, offset } = historyQuery.toApi(state);
  const result = await listMyRevisions(
    request,
    context,
    new URLSearchParams({ limit: String(limit), offset: String(offset) })
  );
  if (result.status === 401) {
    throw redirect(loginHref(`${url.pathname}${url.search}`), {
      headers: result.headers,
    });
  }
  const noted = (name: string) => {
    const id = url.searchParams.get(name) ?? "";
    return isEntityId(id) ? id : null;
  };
  const notes = {
    submitted: noted("submitted"),
    withdrawn: noted("withdrawn"),
  };
  if (!result.ok) {
    return data(
      { ...notes, page: state.page, list: null, error: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  redirectPastTheEnd(state.page, result.data.total, page =>
    historyQuery.href(CONTRIBUTIONS_PATH, page)
  );
  return data(
    { ...notes, page: state.page, list: result.data, error: null },
    { headers: result.headers }
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const form = await request.formData().catch(() => null);
  const id = String(form?.get("revision_id") ?? "");
  if (form?.get("intent") !== "withdraw" || !isEntityId(id)) {
    return data(
      { message: "We couldn’t read the form. Reload the page and try again." },
      { status: 400 }
    );
  }
  const result = await withdrawRevision(request, context, id);
  if (!result.ok) {
    return data(
      { message: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  return redirect(`${CONTRIBUTIONS_PATH}?withdrawn=${id}`, {
    status: 303,
    headers: result.headers,
  });
}

function Actions({ revision }: { readonly revision: RevisionListItem }) {
  if (revision.status !== "pending") return null;
  const { name, path } = revisionEntity(revision);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {path === null ? null : (
        <ButtonLink to={`${path}/edit`} size="sm">
          Continue editing<span className="sr-only"> {name}</span>
        </ButtonLink>
      )}
      <Form method="post" reloadDocument>
        <input type="hidden" name="intent" value="withdraw" />
        <input type="hidden" name="revision_id" value={revision.id} />
        <Button
          type="submit"
          size="sm"
          variant="secondary-danger"
          icon={IconArrowBackUp}
        >
          Withdraw<span className="sr-only"> the edit of {name}</span>
        </Button>
      </Form>
    </div>
  );
}

export default function ContributionsRoute() {
  const { submitted, withdrawn, page, list, error } =
    useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  return (
    <>
      <h1 className="text-h1 text-fg">My contributions</h1>
      <div className="mt-6 grid gap-4">
        {submitted ? (
          <Alert
            tone="success"
            title="Thank you. Your edit is waiting for review."
          >
            A moderator will look at it soon.
          </Alert>
        ) : null}
        {withdrawn ? (
          <Alert tone="success" title="Your edit has been withdrawn." />
        ) : null}
        {failed ? (
          <Alert tone="danger" title="We couldn’t withdraw that edit.">
            {failed.message}
          </Alert>
        ) : null}
        {error === null ? null : (
          <Alert
            tone="danger"
            title="We couldn’t load your contributions."
            actions={
              <ButtonLink to={CONTRIBUTIONS_PATH} reloadDocument>
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
          <EmptyState title="No contributions yet">
            Edit a page, or add a new one, and it will be listed here.{" "}
            <Link to="/help/contributing" appearance="prose">
              How to contribute
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6">
          <RowTable
            label="Your contributions"
            rows={list.data}
            rowKey={revision => String(revision.id)}
            columns={[
              {
                header: "Page",
                cell: revision => {
                  const { name, noun, path } = revisionEntity(revision);
                  return path === null ? (
                    name
                  ) : (
                    <Link to={path} compact>
                      {name}
                      <span className="sr-only"> ({noun})</span>
                    </Link>
                  );
                },
              },
              {
                header: "Status",
                nowrap: true,
                cell: revision => (
                  <>
                    {STATUS_LABELS[revision.status]}
                    {revision.review_note === null ? null : (
                      <p className="mt-1 max-w-xs whitespace-normal text-body-sm text-fg-muted">
                        {`Note: ${revision.review_note}`}
                      </p>
                    )}
                  </>
                ),
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
                header: "Actions",
                cell: revision => <Actions revision={revision} />,
              },
            ]}
          />
          <div className="mt-6">
            <ListPagination
              page={page}
              total={list.total}
              href={n => historyQuery.href(CONTRIBUTIONS_PATH, n)}
            />
          </div>
        </div>
      )}
    </>
  );
}
