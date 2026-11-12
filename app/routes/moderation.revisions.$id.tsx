import { IconCheck, IconX } from "@tabler/icons-react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ServerError } from "~/components/ErrorPages";
import { ModerationNav } from "~/components/moderation/ModerationNav";
import { RevisionDiff } from "~/components/revision/RevisionDiff";
import { Alert } from "~/components/ui/Alert";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/Checkbox";
import { Field } from "~/components/ui/Field";
import { Link } from "~/components/ui/Link";
import { Textarea } from "~/components/ui/Textarea";
import { revisionChanges, type DiffInput } from "~/catalogue/diff";
import { formatDate } from "~/catalogue/format";
import {
  NOT_FOUND,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { revisionCredit } from "~/catalogue/revision-credit";
import { BLOCKING_PATH, MODERATION_PATH } from "~/constants/moderation";
import type { components } from "~/api/schema.gen";
import { readPath } from "~/editing/editor-data";
import { fieldProblem, type FieldProblem } from "~/editing/problems";
import { ENTITY_NOUNS } from "~/editing/revision-entity";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isEntityId } from "~/schemas/address";
import {
  approveRevision,
  getModerationRevision,
  rejectRevision,
} from "~/server/api.server";
import {
  postedForm,
  redirectSignedOut,
  UNREADABLE_FORM,
} from "~/server/moderation.server";

/**
 * /moderation/revisions/:id, a revision's review (plan §5.3, §5.4): what
 * it changed against its base and, when its page has changed since
 * (stale), against the current version, with a warning that approving
 * overwrites those changes. A pending revision is approved (acknowledging
 * a stale one) or rejected with a note to its author, by document POSTs to
 * this route's action, which go back to the queue.
 */

type View = components["schemas"]["ModerationRevisionView"];

export const meta = () => [
  { title: "Review an edit · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

const STATUS_LABELS: Readonly<Record<View["status"], string>> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn by its author",
};

/** The entity as it is now, or for a new one its name in the snapshot. */
function entityOf(view: View) {
  const noun = ENTITY_NOUNS[view.entity_type];
  const { entity, snapshot } = view;
  if (entity === null) {
    const name =
      "title" in snapshot
        ? snapshot.title
        : "display_name" in snapshot
          ? snapshot.display_name
          : snapshot.name;
    return { name, noun, path: null, isNew: true };
  }
  const name =
    "title" in entity
      ? entity.title
      : "display_name" in entity
        ? entity.display_name
        : entity.name;
  const key = "slug" in entity ? entity.slug : entity.id;
  return {
    name,
    noun,
    path: key === null ? null : readPath(view.entity_type, key),
    isNew: false,
  };
}

/**
 * The view as the diff reads it. The spec types `snapshot` apart from
 * `entity_type`, but it is always in that type's shape.
 */
const diffInput = (
  view: View,
  base: Pick<View, "base_snapshot" | "changed_fields">
) =>
  ({
    entity_type: view.entity_type,
    entity: view.entity,
    snapshot: view.snapshot,
    ...base,
  }) as DiffInput;

export async function loader({
  request,
  url,
  params,
  context,
}: LoaderFunctionArgs) {
  const id = params.id ?? "";
  if (!isEntityId(id)) throwPageFailure(NOT_FOUND);
  const result = await getModerationRevision(request, context, id);
  redirectSignedOut(result, url);
  if (result.status === 404) throwPageFailure(NOT_FOUND);
  if (!result.ok) {
    return data(
      { review: null, error: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  const view = result.data;
  const stale = view.current_snapshot !== null;
  // Only what the page shows: the snapshots stay on the server.
  return data(
    {
      review: {
        id: view.id,
        status: view.status,
        summary: view.summary,
        createdAt: view.created_at,
        credit: revisionCredit(view),
        authorUserId: view.author_user_id,
        reviewNote: view.review_note,
        entity: entityOf(view),
        duplicates: view.possible_duplicates.map(match => ({
          name: match.name,
          path: readPath(
            match.entity_type,
            match.slug ?? match.collection_id ?? ""
          ),
        })),
        stale,
        changes: revisionChanges(diffInput(view, view)),
        sinceCurrent: stale
          ? revisionChanges(
              diffInput(view, {
                base_snapshot: view.current_snapshot,
                changed_fields: view.changed_fields_since_current ?? [],
              })
            )
          : null,
      },
      error: null,
    },
    { headers: result.headers }
  );
}

/** Why the decision wasn't recorded. */
type Failed = {
  readonly message: string;
  readonly problems: readonly FieldProblem[];
  readonly noteError: string | null;
  /** The note as posted, so a failed rejection keeps it. */
  readonly note: string;
};

export async function action({ request, params, context }: ActionFunctionArgs) {
  const form = await postedForm(request);
  const id = params.id ?? "";
  const intent = form?.get("intent");
  const answer = (
    message: string,
    init: ResponseInit,
    more: Partial<Omit<Failed, "message">> = {}
  ) =>
    data<Failed>(
      { message, problems: [], noteError: null, note: "", ...more },
      init
    );
  if (
    !form ||
    !isEntityId(id) ||
    (intent !== "approve" && intent !== "reject")
  ) {
    return answer(UNREADABLE_FORM, { status: 400 });
  }
  const note = String(form.get("note") ?? "").trim();
  if (intent === "reject" && note === "") {
    return answer(
      "Write a note for the author.",
      { status: 400 },
      { noteError: "Say why, so the author knows what to change.", note }
    );
  }
  const result =
    intent === "approve"
      ? await approveRevision(request, context, id, {
          acknowledge_stale: form.has("acknowledge_stale"),
        })
      : await rejectRevision(request, context, id, { note });
  if (!result.ok) {
    return answer(
      result.error.message,
      { status: result.status, headers: result.headers },
      { problems: (result.error.problems ?? []).map(fieldProblem), note }
    );
  }
  const done = intent === "approve" ? "approved" : "rejected";
  return redirect(`${MODERATION_PATH}?${done}=${id}`, {
    status: 303,
    headers: result.headers,
  });
}

function Decision({
  stale,
  noteError,
  note,
}: {
  readonly stale: boolean;
  readonly noteError: string | null;
  readonly note: string;
}) {
  return (
    <section aria-labelledby="decision" className="mt-8 stack-y-6">
      <h2 id="decision" className="text-h2 text-fg">
        Your decision
      </h2>
      <Form method="post" reloadDocument className="stack-y-4">
        <input type="hidden" name="intent" value="approve" />
        {stale ? (
          <Checkbox
            name="acknowledge_stale"
            label="Approve anyway, replacing the changes made since this edit was started"
          />
        ) : null}
        <Button type="submit" variant="primary" icon={IconCheck}>
          Approve
        </Button>
      </Form>
      <Form method="post" reloadDocument className="stack-y-4">
        <input type="hidden" name="intent" value="reject" />
        <Field
          label="Note to the author"
          help="Say what to change, or why it can’t go in. They see it with their edit."
          error={noteError}
        >
          <Textarea name="note" defaultValue={note} maxLength={2000} required />
        </Field>
        <Button type="submit" variant="secondary-danger" icon={IconX}>
          Reject
        </Button>
      </Form>
    </section>
  );
}

export default function ReviewRoute() {
  const { review, error } = useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  if (review === null) {
    return (
      <>
        <h1 className="text-h1 text-fg">Review an edit</h1>
        <ModerationNav />
        <div className="mt-6">
          <Alert tone="danger" title="We couldn’t load this edit.">
            {error}
          </Alert>
        </div>
      </>
    );
  }
  const { entity } = review;
  const heading = entity.isNew
    ? `New ${entity.noun}: ${entity.name}`
    : `Edit of ${entity.name}`;
  return (
    <>
      <div className="mb-2">
        <Breadcrumbs
          trail={[{ label: "Moderation queue", to: MODERATION_PATH }]}
          current={`Revision ${review.id}`}
        />
      </div>
      <h1 className="text-h1 text-fg">{heading}</h1>
      <p className="mt-1 text-body-sm text-fg-muted">
        {`Revision ${review.id} · `}
        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {` · ${review.credit} · ${STATUS_LABELS[review.status]}`}
      </p>
      {review.summary === "" ? null : (
        <blockquote className="mt-4 border-l-3 border-border-strong pl-4 text-body text-fg">
          {review.summary}
        </blockquote>
      )}
      <ul
        role="list"
        className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm"
      >
        {entity.path === null ? null : (
          <li>
            <Link to={entity.path} compact>
              View the {entity.noun} as it is now
            </Link>
          </li>
        )}
        {review.authorUserId === null ? null : (
          <li>
            <Link
              to={`${BLOCKING_PATH}?${new URLSearchParams({ id: review.authorUserId })}`}
              compact
            >
              Block or unblock the author
            </Link>
          </li>
        )}
      </ul>
      <div className="mt-6 grid gap-4">
        {failed ? (
          <Alert tone="danger" title="We couldn’t record your decision.">
            <p>{failed.message}</p>
            {failed.problems.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {failed.problems.map(problem => (
                  <li key={problem.fieldId}>
                    {problem.field}: {problem.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {review.status === "pending" ? null : (
          <Alert
            tone="info"
            title={`This edit is ${STATUS_LABELS[review.status].toLowerCase()}.`}
          >
            {review.reviewNote === null ? null : `Note: ${review.reviewNote}`}
          </Alert>
        )}
        {review.stale && review.status === "pending" ? (
          <Alert
            tone="warning"
            title={`This ${entity.noun} has changed since this edit was started.`}
          >
            Approving it replaces the changes made since, shown below against
            the current version. To keep them, reject the edit and ask for it to
            be made again on the current version.
          </Alert>
        ) : null}
        {review.duplicates.length > 0 ? (
          <Alert tone="warning" title="This may already be in the catalogue.">
            <ul className="list-disc pl-5">
              {review.duplicates.map(match => (
                <li key={match.path}>
                  <Link to={match.path} appearance="inherit">
                    {match.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </div>
      <RevisionDiff changes={review.changes} />
      {review.sinceCurrent ? (
        <RevisionDiff
          changes={review.sinceCurrent}
          heading="Compared with the current version"
        />
      ) : null}
      {review.status === "pending" ? (
        <Decision
          stale={review.stale}
          noteError={failed?.noteError ?? null}
          note={failed?.note ?? ""}
        />
      ) : null}
    </>
  );
}

/** The edit couldn't be shown: not found, or anything else, in the shell. */
export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} missing="that edit" />
  ) : (
    <ServerError title="We couldn’t load this edit" reference={reference} />
  );
}
