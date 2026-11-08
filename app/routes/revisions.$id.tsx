import {
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { RevisionDiff } from "~/components/revision/RevisionDiff";
import { Alert } from "~/components/ui/Alert";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { ButtonLink } from "~/components/ui/Button";
import { Link } from "~/components/ui/Link";
import { revisionChanges } from "~/catalogue/diff";
import { formatDate } from "~/catalogue/format";
import { failureMeta } from "~/catalogue/entity-route";
import { catalogueHeaders } from "~/catalogue/headers";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { revisionCredit } from "~/catalogue/revision-credit";
import { pageMeta } from "~/catalogue/seo";
import { categoryPath } from "~/catalogue/term-page";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isEntityId } from "~/schemas/address";
import type { Revision } from "~/schemas/catalogue";
import { getRevision } from "~/server/catalogue.server";

/**
 * `/revisions/:id`: one approved revision and what it changed (plan
 * §4.11), for any of the five entity types (the API's `entity_type`). The
 * heading and links name the entity as it is now (`entity`). Snapshots are
 * redacted by what is visible today, so the page always says so: it never
 * passes a view off as what was saved. `noindex, follow`.
 */

const WHAT = "this revision";
const MISSING = "that revision";

export const headers = catalogueHeaders;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const id = params.id ?? "";
  if (!isEntityId(id)) throwPageFailure({ kind: "not_found" });
  const result = await getRevision(context, id);
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  return { revision: result.data, changes: revisionChanges(result.data) };
}

/** Where a revision's entity lives, what it's called, and its section. */
function entityOf(revision: Revision): {
  readonly section: { readonly label: string; readonly to: string };
  readonly noun: string;
  readonly title: string;
  readonly path: string;
} {
  switch (revision.entity_type) {
    case "piece":
      return {
        section: { label: "Pieces", to: "/pieces" },
        noun: "piece",
        title: revision.entity.title,
        path: `/pieces/${revision.entity.slug}`,
      };
    case "person":
      return {
        section: { label: "Bards", to: "/bards" },
        noun: "bard",
        title: revision.entity.name,
        path: `/bards/${revision.entity.slug}`,
      };
    case "term":
      return {
        section: { label: "Categories", to: "/categories" },
        noun: "category",
        title: revision.entity.display_name,
        path: categoryPath(revision.entity.slug),
      };
    case "collection":
      return {
        section: { label: "Collections", to: "/collections" },
        noun: "collection",
        title: revision.entity.name,
        path: `/collections/${revision.entity.id}`,
      };
    case "event":
      return {
        section: { label: "Events and venues", to: "/events" },
        noun: revision.entity.kind === "venue" ? "venue" : "event",
        title: revision.entity.name,
        path: `/events/${revision.entity.slug}`,
      };
  }
}

export const meta: MetaFunction = args => {
  if (args.error) return failureMeta(args.error, WHAT, MISSING);
  // The loader's answer: an error, if any, is handled above.
  const revision = (
    args.loaderData as { readonly revision: Revision } | undefined
  )?.revision;
  if (!revision) return [...SERVER_ERROR_META];
  const { title } = entityOf(revision);
  return pageMeta(args, {
    title: `Revision ${revision.id} of ${title}`,
    description: `What revision ${revision.id} of ${title} changed in the Bardic Torch catalogue, and who made it.`,
    path: `/revisions/${revision.id}`,
    robots: "noindex, follow",
  });
};

export default function RevisionRoute() {
  const { revision, changes } = useLoaderData<typeof loader>();
  const entity = entityOf(revision);
  return (
    <>
      <div className="mb-2">
        <Breadcrumbs
          trail={[
            entity.section,
            { label: entity.title, to: entity.path },
            { label: "History", to: `${entity.path}/history` },
          ]}
          current={`Revision ${revision.id}`}
        />
      </div>
      <h1 className="text-h1 text-fg">
        Revision {revision.id} of {entity.title}
      </h1>
      <p className="mt-1 text-body-sm text-fg-muted">
        <time dateTime={revision.created_at}>
          {formatDate(revision.created_at)}
        </time>
        {` · ${revisionCredit(revision)}`}
      </p>
      {revision.summary === "" ? null : (
        <blockquote className="mt-4 border-l-3 border-border-strong pl-4 text-body text-fg">
          {revision.summary}
        </blockquote>
      )}
      <ul
        role="list"
        className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body-sm"
      >
        <li>
          <Link to={entity.path} compact>
            View the {entity.noun} as it is now
          </Link>
        </li>
        {revision.base_revision_id === null ? null : (
          <li>
            <ButtonLink to={`/revisions/${revision.base_revision_id}`}>
              Older revision
            </ButtonLink>
          </li>
        )}
      </ul>
      <div className="mt-6">
        <Alert tone="info" title="This is how the revision looks today.">
          Anything that has since been hidden, made private or removed is left
          out, so it may differ from what was saved at the time.
        </Alert>
      </div>
      <RevisionDiff changes={changes} />
    </>
  );
}

/**
 * The revision couldn't be shown: not found (an unknown or unapproved id,
 * or one whose entity isn't public), an outage, a server error or an
 * answer we couldn't read, inside the shell.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} what={WHAT} missing={MISSING} />
  ) : (
    <ServerError title={`We couldn’t load ${WHAT}`} reference={reference} />
  );
}
