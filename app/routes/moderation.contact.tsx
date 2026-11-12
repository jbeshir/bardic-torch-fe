import { IconCheck, IconX } from "@tabler/icons-react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { components } from "~/api/schema.gen";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ModerationNav } from "~/components/moderation/ModerationNav";
import { Alert } from "~/components/ui/Alert";
import { Button, ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Field } from "~/components/ui/Field";
import { Link, linkClasses } from "~/components/ui/Link";
import { Textarea } from "~/components/ui/Textarea";
import { formatDate } from "~/catalogue/format";
import { redirectPastTheEnd } from "~/catalogue/paging";
import { historyQuery } from "~/catalogue/query-state";
import { isUserUrl } from "~/catalogue/user-url";
import { CONTACT_INBOX_PATH, TAKEDOWN_PATH } from "~/constants/moderation";
import { CONTACT_KIND_LABELS } from "~/constants/vocabulary";
import { isEntityId } from "~/schemas/address";
import { closeContactRequest, listContactRequests } from "~/server/api.server";
import {
  postedForm,
  redirectSignedOut,
  UNREADABLE_FORM,
} from "~/server/moderation.server";

/**
 * /moderation/contact, the contact inbox: the contact form's requests
 * (link reports among them) with one status, oldest first, 50 a page. An
 * open one is resolved or dismissed with an optional note, by a document
 * POST to this route's action. A request with an address links to the
 * takedown page with it.
 */

type ContactRequest = components["schemas"]["ContactRequest"];
type Status = ContactRequest["status"];

const STATUSES: readonly { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export const meta = () => [
  { title: "Contact inbox · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

/** The inbox's address for a status and page; open and page 1 are the default. */
function inboxHref(status: Status, page: number) {
  const query = new URLSearchParams(
    [
      ["status", status === "open" ? "" : status],
      ["page", page > 1 ? String(page) : ""],
    ].filter(([, value]) => value !== "")
  ).toString();
  return query === "" ? CONTACT_INBOX_PATH : `${CONTACT_INBOX_PATH}?${query}`;
}

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const asked = url.searchParams.get("status");
  const status = STATUSES.find(({ value }) => value === asked)?.value ?? "open";
  const { state } = historyQuery.parse(url.searchParams);
  const { limit, offset } = historyQuery.toApi(state);
  const result = await listContactRequests(
    request,
    context,
    new URLSearchParams({
      status,
      limit: String(limit),
      offset: String(offset),
    })
  );
  redirectSignedOut(result, url);
  const closed = url.searchParams.get("closed") ?? "";
  const shown = {
    status,
    page: state.page,
    closed: isEntityId(closed) ? closed : null,
  };
  if (!result.ok) {
    return data(
      { ...shown, list: null, error: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  redirectPastTheEnd(state.page, result.data.total, page =>
    inboxHref(status, page)
  );
  return data(
    { ...shown, list: result.data, error: null },
    { headers: result.headers }
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const form = await postedForm(request);
  const id = String(form?.get("request_id") ?? "");
  const status = form?.get("status");
  if (!isEntityId(id) || (status !== "resolved" && status !== "dismissed")) {
    return data({ message: UNREADABLE_FORM }, { status: 400 });
  }
  const note = String(form?.get("note") ?? "").trim();
  const result = await closeContactRequest(request, context, id, {
    status,
    note: note === "" ? null : note,
  });
  if (!result.ok) {
    return data(
      { message: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  return redirect(`${CONTACT_INBOX_PATH}?closed=${id}`, {
    status: 303,
    headers: result.headers,
  });
}

function Request({ request }: { readonly request: ContactRequest }) {
  const headingId = `request-${request.id}`;
  const { url } = request;
  const takedown =
    url === null ? null : `${TAKEDOWN_PATH}?${new URLSearchParams({ url })}`;
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg border border-border bg-surface p-4 md:p-5"
    >
      <h2 id={headingId} className="text-h3 text-fg">
        {CONTACT_KIND_LABELS[request.kind]}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted">
        <time dateTime={request.created_at}>
          {formatDate(request.created_at)}
        </time>
        {` · ${request.name ?? "No name given"}`}
        {request.email === null ? null : (
          <>
            {" · "}
            <a
              href={`mailto:${encodeURIComponent(request.email)}`}
              className={`${linkClasses("standalone")} break-all`}
            >
              {request.email}
            </a>
          </>
        )}
      </p>
      {url === null ? null : (
        <p className="mt-3 text-body-sm break-words">
          <span className="font-semibold">About: </span>
          {isUserUrl(url) ? (
            <Link to={url} userContent appearance="prose">
              {url}
            </Link>
          ) : (
            url
          )}
        </p>
      )}
      <p className="mt-3 text-body whitespace-pre-wrap text-fg">
        {request.message}
      </p>
      {takedown === null ? null : (
        <p className="mt-3 text-body-sm">
          <Link to={takedown} compact>
            Find this link to take it down
          </Link>
        </p>
      )}
      {request.resolution ? (
        <p className="mt-4 border-t border-border pt-3 text-body-sm text-fg-muted">
          {request.status === "resolved" ? "Resolved" : "Dismissed"} on{" "}
          <time dateTime={request.resolution.resolved_at}>
            {formatDate(request.resolution.resolved_at)}
          </time>
          {request.resolution.note === null
            ? "."
            : `: ${request.resolution.note}`}
        </p>
      ) : (
        <Form
          method="post"
          reloadDocument
          className="mt-4 stack-y-4 border-t border-border pt-4"
        >
          <input type="hidden" name="request_id" value={request.id} />
          <Field label="Note" optional help="For the moderators only.">
            <Textarea name="note" maxLength={2000} rows={2} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="status"
              value="resolved"
              variant="primary"
              icon={IconCheck}
            >
              Resolve
            </Button>
            <Button type="submit" name="status" value="dismissed" icon={IconX}>
              Dismiss
            </Button>
          </div>
        </Form>
      )}
    </article>
  );
}

export default function ContactInboxRoute() {
  const { status, page, closed, list, error } = useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  return (
    <>
      <h1 className="text-h1 text-fg">Contact inbox</h1>
      <ModerationNav />
      <nav aria-label="Requests by status" className="mt-6">
        <ul role="list" className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          {STATUSES.map(({ value, label }) => (
            <li key={value}>
              <Link to={inboxHref(value, 1)} compact current={value === status}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 grid gap-4">
        {closed ? (
          <Alert tone="success" title="The request is closed." />
        ) : null}
        {failed ? (
          <Alert tone="danger" title="We couldn’t close that request.">
            {failed.message}
          </Alert>
        ) : null}
        {error === null ? null : (
          <Alert
            tone="danger"
            title="We couldn’t load the inbox."
            actions={
              <ButtonLink to={inboxHref(status, page)} reloadDocument>
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
          <EmptyState title="No requests here">
            Messages sent through the contact form, link reports among them, are
            listed here, oldest first.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {list.data.map(request => (
            <Request key={request.id} request={request} />
          ))}
          <ListPagination
            page={page}
            total={list.total}
            href={n => inboxHref(status, n)}
          />
        </div>
      )}
    </>
  );
}
