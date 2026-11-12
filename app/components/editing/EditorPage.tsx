import { Form, useRouteLoaderData } from "react-router";
import { IconEye, IconSend } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { UserMarkdown } from "~/components/UserMarkdown";
import { Alert, AlertRegion } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/Checkbox";
import { ErrorSummary } from "~/components/ui/ErrorSummary";
import { Link } from "~/components/ui/Link";
import {
  readPath,
  type EditorActionData,
  type EditorLoaderData,
} from "~/editing/editor-data";
import type { MarkdownTree } from "~/schemas/markdown";
import type { loader as rootLoader } from "~/root";
import { FieldErrorsContext, TextField } from "./fields";

/**
 * The shell of every editor (plan "Shared editor shell"): the h1 of a new
 * page (an edit is under its entity's head, on the Edit tab), the error
 * summary, the preview, then one document POST form: the duplicate or
 * stale warning with its acknowledge box, the type's fields, the summary,
 * the CC BY-SA notice and the buttons. Enter previews (the hidden first
 * button), never submits. A document the reader can't edit is its notice
 * instead of the form.
 */
export function EditorPage<D extends { readonly schema_version: number }, P>({
  heading,
  loaded,
  action,
  preview,
  children,
}: {
  /** A new page's h1: "New event". */
  readonly heading?: string;
  readonly loaded: EditorLoaderData<D>;
  readonly action: EditorActionData<D, P> | undefined;
  /** The type's preview of `action.preview`, after Preview. */
  readonly preview?: ReactNode;
  /** The type's fields for the document. */
  readonly children: (document: D) => ReactNode;
}) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const previewId = useId();
  const moderator =
    root?.account.state === "signed-in" &&
    root.account.user.role === "moderator";
  const document = action?.document ?? loaded.document;
  const [first, ...more] = (action?.problems ?? []).map(problem => ({
    fieldId: problem.fieldId,
    message: `${problem.field}: ${problem.message}`,
  }));
  const warned = Boolean(action?.duplicates.length) || action?.stale;

  return (
    <div className="not-prose stack-y-6">
      {heading ? <h1 className="text-h1 text-fg">{heading}</h1> : null}
      {loaded.notice ? <Alert tone="info">{loaded.notice}</Alert> : null}
      {first ? <ErrorSummary problems={[first, ...more]} /> : null}
      {action?.message && !first && !warned ? (
        <AlertRegion urgent>
          <Alert tone="danger">{action.message}</Alert>
        </AlertRegion>
      ) : null}
      {preview ? (
        <section
          aria-labelledby={previewId}
          className="rounded-lg border border-border bg-surface p-4 md:p-5"
        >
          <h2 id={previewId} className="mb-3 text-h3 text-fg">
            Preview
          </h2>
          {preview}
        </section>
      ) : null}
      {document ? (
        <Form method="post" reloadDocument className="stack-y-6">
          <button type="submit" name="intent" value="preview" hidden />
          <input
            type="hidden"
            name="schema_version"
            value={document.schema_version}
          />
          {loaded.baseRevisionId === null ? null : (
            <input
              type="hidden"
              name="base_revision_id"
              value={loaded.baseRevisionId}
            />
          )}
          {action?.duplicates.length ? (
            <Alert tone="warning" title="This may already be here">
              <p>{action.message}</p>
              <ul className="mt-2 list-disc pl-5">
                {action.duplicates.map(match => (
                  <li key={`${match.slug}-${match.collection_id}`}>
                    <Link
                      to={readPath(
                        match.entity_type,
                        match.slug ?? match.collection_id ?? ""
                      )}
                      appearance="prose"
                    >
                      {match.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Checkbox
                name="acknowledge_duplicates"
                label="Mine is not one of these"
              />
            </Alert>
          ) : null}
          {action?.stale ? (
            <Alert tone="warning" title="This page has changed">
              <p>{action.message}</p>
              <Checkbox
                name="acknowledge_stale"
                label="Save over the changes made since"
              />
            </Alert>
          ) : null}
          <FieldErrorsContext
            value={Object.fromEntries(
              (action?.problems ?? []).map(p => [p.fieldId, p.message])
            )}
          >
            <div className="stack-y-6">{children(document)}</div>
            <TextField
              name="summary"
              label="Summary of your changes"
              help="A few words on what you changed and why, for the moderators and the page’s history."
              value={action?.summary ?? loaded.summary}
              optional
            />
          </FieldErrorsContext>
          <p className="text-body-sm text-fg-muted">
            By saving, you agree to release your contribution under{" "}
            <Link to="/help/licence" appearance="prose">
              CC BY-SA 4.0
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              name="intent"
              value="preview"
              formNoValidate
              icon={IconEye}
            >
              Preview
            </Button>
            <Button
              type="submit"
              name="intent"
              value="submit"
              variant="primary"
              icon={IconSend}
            >
              {moderator ? "Save" : "Submit for review"}
            </Button>
          </div>
        </Form>
      ) : null}
    </div>
  );
}

/** The preview of a description: the Markdown as its page shows it. */
export function MarkdownPreview({
  tree,
}: {
  readonly tree: MarkdownTree | null;
}) {
  return tree ? (
    <div className="prose-bt">
      <UserMarkdown tree={tree} />
    </div>
  ) : (
    <p className="text-body text-fg-muted">There’s no description yet.</p>
  );
}
