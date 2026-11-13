import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouterContextProvider,
} from "react-router";
import type { z } from "zod";
import { NOT_FOUND, throwPageFailure } from "~/catalogue/read-failure";
import { CONTRIBUTIONS_PATH, loginHref } from "~/constants/account";
import { FACET_LABELS } from "~/constants/vocabulary";
import { DOCUMENT_SCHEMAS, type EntityType } from "~/editing/documents";
import {
  readPath,
  type EditorActionData,
  type EditorLoaderData,
  type Option,
  type Options,
  type Picker,
} from "~/editing/editor-data";
import { decodeForm } from "~/editing/form-codec";
import { fromSnapshot } from "~/editing/from-snapshot";
import { fieldProblem } from "~/editing/problems";
import { isEntityId, isSlug } from "~/schemas/address";
import { getEditable, listMyRevisions, submitRevision } from "./api.server";
import { getServerAuthContext } from "./auth.server";
import {
  listCollections,
  listEvents,
  listPersons,
  listPieces,
  getRevision,
  listTerms,
  type ReadResult,
} from "./catalogue.server";
import { assertSameOrigin } from "./csrf.server";
import { renderMarkdown } from "./markdown.server";

/**
 * The loader and action every edit and new route shares (plan "No client
 * JS"). The form is a document POST to its own route's action, which
 * checks same-origin, decodes the form (form-codec.ts) and either adds or
 * removes a row, previews, or submits the revision and answers with its
 * outcome: a 303 on success, otherwise the form again with what went wrong.
 */

type Document<T extends EntityType> = z.output<(typeof DOCUMENT_SCHEMAS)[T]>;

const PAGE = 100;

async function termOptions(
  context: Readonly<RouterContextProvider>
): Promise<Options> {
  const result = await listTerms(context, {});
  if (!result.ok) throwPageFailure(result.failure);
  const depths = new Map<string, number>();
  const all = result.data.data.map(term => {
    const depth =
      term.parent_slug === null ? 0 : (depths.get(term.parent_slug) ?? 0) + 1;
    depths.set(term.slug, depth);
    // No-break spaces: an option collapses plain ones.
    const label = `${"\u00a0\u00a0".repeat(depth)}${term.name}`;
    return { term, option: { value: term.slug, label } };
  });
  return {
    terms: all.map(({ term, option }) => ({
      ...option,
      group: FACET_LABELS[term.facet],
    })),
    affiliations: all
      .filter(({ term }) => term.facet === "affiliation")
      .map(({ option }) => option),
  };
}

type Page = { readonly limit: number; readonly offset: number };

/** Every item of a public list, a page of 100 at a time, as options. */
async function pagedOptions<T>(
  read: (
    page: Page
  ) => Promise<
    ReadResult<{ readonly data: readonly T[]; readonly total: number }>
  >,
  option: (item: T) => Option
): Promise<Option[]> {
  const options: Option[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const result = await read({ limit: PAGE, offset });
    if (!result.ok) throwPageFailure(result.failure);
    const { data: page, total } = result.data;
    options.push(...page.map(option));
    if (page.length === 0 || offset + PAGE >= total) return options;
  }
}

/** The paged pickers' lists: each public list's entities by slug (or id). */
const PAGED = {
  collections: context =>
    pagedOptions(
      page => listCollections(context, page),
      ({ id, name }) => ({ value: String(id), label: name })
    ),
  persons: context =>
    pagedOptions(
      page => listPersons(context, page),
      // A list of persons always sets the slug.
      ({ slug, name }) => ({ value: slug ?? "", label: name })
    ),
  pieces: context =>
    pagedOptions(
      page => listPieces(context, page),
      ({ slug, title }) => ({ value: slug, label: title })
    ),
  events: context =>
    pagedOptions(
      page => listEvents(context, page),
      ({ slug, name }) => ({ value: slug, label: name })
    ),
} as const satisfies Record<
  Exclude<Picker, "terms" | "affiliations">,
  (context: Readonly<RouterContextProvider>) => Promise<Option[]>
>;

/** The option lists `pickers` need, loaded together; a failure is the page's. */
async function loadOptions(
  context: Readonly<RouterContextProvider>,
  pickers: readonly Picker[]
): Promise<Options> {
  const paged = (Object.keys(PAGED) as (keyof typeof PAGED)[]).filter(picker =>
    pickers.includes(picker)
  );
  const lists = await Promise.all([
    pickers.includes("terms") || pickers.includes("affiliations")
      ? termOptions(context)
      : {},
    ...paged.map(async picker => ({ [picker]: await PAGED[picker](context) })),
  ]);
  return Object.assign({}, ...lists) as Options;
}

/**
 * `?revert=` (a link from a revision's page): revision `id`'s snapshot over
 * the entity's editable `document`, with the summary "Revert to revision
 * N". A revision that can't be read, or is of another entity, is a notice
 * and the document as it is.
 */
async function revertTo<D>(
  context: Readonly<RouterContextProvider>,
  {
    type,
    key,
    id,
    document,
  }: {
    readonly type: EntityType;
    readonly key: string;
    readonly id: string;
    readonly document: D;
  }
): Promise<{ document: D; summary: string; notice: string | null }> {
  const result = isEntityId(id) ? await getRevision(context, id) : null;
  const as = (notice: string) => ({ document, summary: "", notice });
  if (!result?.ok) {
    return as(
      "We couldn’t load the revision to revert to, so this is the page as it is now."
    );
  }
  const { entity_type, entity } = result.data;
  if (
    entity_type !== type ||
    String("slug" in entity ? entity.slug : entity.id) !== key
  ) {
    return as(
      "That revision is of a different page, so this is the page as it is now."
    );
  }
  return {
    document: { ...document, ...fromSnapshot(result.data) },
    summary: `Revert to revision ${id}`,
    notice: null,
  };
}

/**
 * An edit route's (`key`, the slug or id in its path) or a new route's
 * loader: signed out goes to log in and back; the entity's editable
 * document, or for a new one a blank document; and the pickers' lists.
 * A document the reader can't edit (a blocked account, an outage) is a
 * notice in its place.
 */
export async function editorLoader<T extends EntityType>(
  { request, url, context }: LoaderFunctionArgs,
  {
    type,
    key,
    pickers = [],
  }: {
    readonly type: T;
    readonly key?: string;
    readonly pickers?: readonly Picker[];
  }
) {
  const login = loginHref(`${url.pathname}${url.search}`);
  const auth = await getServerAuthContext(request, context);
  if (!auth.authContext.isAuthenticated) {
    throw redirect(login, { headers: new Headers(auth.headers) });
  }
  const valid = type === "collection" ? isEntityId : isSlug;
  if (key !== undefined && !valid(key)) throwPageFailure(NOT_FOUND);

  const [editable, options] = await Promise.all([
    key === undefined ? null : getEditable(request, context, type, key),
    loadOptions(context, pickers),
  ]);
  const headers = editable?.headers ?? new Headers(auth.headers);
  if (editable?.status === 401) throw redirect(login, { headers });
  if (editable?.status === 404) throwPageFailure(NOT_FOUND);

  const revert = url.searchParams.get("revert");
  const reverted =
    key !== undefined && editable?.ok && revert !== null
      ? await revertTo(context, {
          type,
          key,
          id: revert,
          document: editable.data.document as Document<T>,
        })
      : null;
  const loaded: EditorLoaderData<Document<T>> = editable
    ? {
        document: editable.ok
          ? (reverted?.document ?? (editable.data.document as Document<T>))
          : null,
        baseRevisionId: editable.ok ? editable.data.base_revision_id : null,
        notice: editable.ok
          ? (reverted?.notice ?? null)
          : editable.error.message,
        summary: reverted?.summary ?? "",
        options,
      }
    : {
        document: DOCUMENT_SCHEMAS[type].parse({}) as Document<T>,
        baseRevisionId: null,
        notice: null,
        summary: "",
        options,
      };
  return data(loaded, { headers });
}

/**
 * An edit or new route's action. `preview` makes what the page's Preview
 * shows from the document, on the server (Markdown, say), with the lists
 * of `pickers` for the names of the references (loaded for a preview only).
 */
export async function editorAction<T extends EntityType, P>(
  { request, context }: ActionFunctionArgs,
  {
    type,
    preview,
    pickers = [],
  }: {
    readonly type: T;
    readonly preview: (document: Document<T>, options: Options) => P;
    readonly pickers?: readonly Picker[];
  }
) {
  assertSameOrigin(request);
  const posted = await request.formData().catch(() => null);
  const form =
    posted &&
    decodeForm(
      type,
      new URLSearchParams(
        [...posted].map(([name, value]) => [name, String(value)])
      )
    );
  const answer = (
    outcome: Partial<EditorActionData<Document<T>, P>>,
    init?: ResponseInit
  ) => {
    const full: EditorActionData<Document<T>, P> = {
      document: form?.document ?? null,
      summary: form?.summary ?? "",
      preview: null,
      message: null,
      problems: [],
      duplicates: [],
      stale: false,
      ...outcome,
    };
    return data(full, init);
  };
  if (!form) {
    return answer(
      {
        message: posted
          ? "Some of the form’s values couldn’t be read. Check them and try again."
          : "We couldn’t read the form. Reload the page and try again.",
      },
      { status: 400 }
    );
  }
  if (form.intent.kind === "preview") {
    const options = await loadOptions(context, pickers);
    return answer({ preview: preview(form.document, options) });
  }
  if (form.intent.kind !== "submit") return answer({});

  const result = await submitRevision(request, context, {
    entity_type: type,
    base_revision_id: form.baseRevisionId,
    summary: form.summary,
    document: form.document,
    acknowledge_duplicates: form.acknowledgeDuplicates,
    acknowledge_stale: form.acknowledgeStale,
  });
  if (result.ok) {
    const { id, status, entity } = result.data;
    const key =
      entity === null ? null : "slug" in entity ? entity.slug : entity.id;
    const to =
      status === "approved" && key !== null
        ? readPath(type, key)
        : `${CONTRIBUTIONS_PATH}?submitted=${id}`;
    return redirect(to, { status: 303, headers: result.headers });
  }
  const { error } = result;
  return answer(
    {
      message: error.message,
      problems: (error.problems ?? []).map(fieldProblem),
      duplicates: error.duplicates ?? [],
      stale: error.code === "stale_revision",
    },
    { status: result.status, headers: result.headers }
  );
}

/** The preview of a type whose page is its description (collection, term). */
export const previewDescription = (document: {
  readonly description_md: string | null;
}) => ({ description: renderMarkdown(document.description_md) });

/** The preview of an event, whose page is its name. */
export const previewName = (document: { readonly name: string }) => ({
  name: document.name,
});

/**
 * Whether the signed-in reader has an edit of this entity waiting for
 * review (the pending banner), for an entity layout's loader. Signed out,
 * or a failed lookup, is no banner: it is a convenience, not the page.
 */
export async function hasPendingRevision(
  { request, context }: Pick<LoaderFunctionArgs, "request" | "context">,
  type: EntityType,
  key: string
): Promise<boolean> {
  const result = await listMyRevisions(
    request,
    context,
    new URLSearchParams({ status: "pending", limit: "30" })
  );
  return (
    result.ok &&
    result.data.data.some(
      ({ entity_type, entity }) =>
        entity_type === type &&
        entity !== null &&
        (entity.slug ?? String(entity.collection_id)) === key
    )
  );
}
