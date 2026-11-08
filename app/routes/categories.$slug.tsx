import {
  Outlet,
  useLoaderData,
  useLocation,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { EntityPage } from "~/components/EntityPage";
import { SERVER_ERROR_META, ServerError } from "~/components/ErrorPages";
import { LicenceLine } from "~/components/catalogue/LicenceLine";
import { Infobox } from "~/components/ui/Infobox";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { UserMarkdown } from "~/components/UserMarkdown";
import { catalogueHeaders } from "~/catalogue/headers";
import { categoryIndexQuery } from "~/catalogue/query-state";
import {
  asPageFailure,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { failureMeta, ignoreSearchChanges } from "~/catalogue/entity-route";
import { pageMeta } from "~/catalogue/seo";
import { categoryMeta, categoryPath, memberCount } from "~/catalogue/term-page";
import { FACET_LABELS } from "~/constants/vocabulary";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Term, TermSummary } from "~/schemas/catalogue";
import { getTerm } from "~/server/catalogue.server";
import { renderMarkdown } from "~/server/markdown.server";

/**
 * `/categories/:slug`, the layout of a category's page (plan §1, §4.8):
 * the head (breadcrumbs, the h1, the meta line, the Read and History
 * tabs) and, on Read, the infobox, the description, the subcategories, the
 * chip row and the licence line, all from `getTerm` with one member. The
 * members are the Read child's own read (`categories.$slug._index.tsx`),
 * so paging them, or the history, never reloads this one.
 *
 * The slug is checked before any call: one the API would refuse (`%2F`,
 * upper case, a trailing hyphen) is our own 404.
 */

const WHAT = "this category";
const MISSING = "that category";

export const headers = catalogueHeaders;

export const shouldRevalidate = ignoreSearchChanges;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  if (!isSlug(slug)) throwPageFailure({ kind: "not_found" });
  const result = await getTerm(context, slug, { limit: 1 });
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  const term = result.data;
  // The Markdown is parsed here, on the server: the browser gets the tree.
  return { term, description: renderMarkdown(term.description_md) };
}

export const meta: MetaFunction = args => {
  if (args.error) return failureMeta(args.error, WHAT, MISSING);
  // The loader's answer: an error, if any, is handled above.
  const term = (args.loaderData as { readonly term: Term } | undefined)?.term;
  if (!term) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title: term.display_name,
    description: `${categoryMeta(term)} in the Bardic Torch catalogue.`,
    path: `/categories/${term.slug}`,
  });
};

function termLink(term: TermSummary) {
  return (
    <Link to={categoryPath(term.slug)} appearance="prose">
      {term.display_name}
    </Link>
  );
}

function TermInfobox({ term }: { readonly term: Term }) {
  const parent = term.ancestors.at(-1);
  const rows = [
    ...(term.aliases.length > 0
      ? [{ label: "Also called", value: term.aliases.join(", ") }]
      : []),
    ...(parent ? [{ label: "Part of", value: termLink(parent) }] : []),
    ...(term.related_affiliation
      ? [
          {
            label: "Related affiliation",
            value: termLink(term.related_affiliation),
          },
        ]
      : []),
  ];
  if (rows.length === 0) return null;
  return (
    <Infobox
      title={term.display_name}
      subtitle={FACET_LABELS[term.facet]}
      sections={[{ heading: "Details", rows }]}
    />
  );
}

/** The term's children, as chips with their counts. */
function Subcategories({ term }: { readonly term: Term }) {
  if (term.children.length === 0) return null;
  return (
    <div className="not-prose mt-8">
      <h2 className="mb-3 text-h3 text-fg">Subcategories</h2>
      <TagList
        tags={term.children.map(child => ({
          label: `${child.term.display_name} (${memberCount({
            facet: term.facet,
            piece_count: child.piece_count,
            person_count: child.person_count,
          })})`,
          to: categoryPath(child.term.slug),
        }))}
      />
    </div>
  );
}

export default function CategoryLayout() {
  const { term, description } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const path = categoryPath(term.slug);
  const reading = pathname === path;
  const facetLabel = FACET_LABELS[term.facet];
  return (
    <EntityPage
      path={path}
      title={term.display_name}
      subtitle={categoryMeta(term)}
      breadcrumbs={{
        trail: [
          { label: "Categories", to: "/categories" },
          { label: facetLabel, to: categoryIndexQuery.href(term.facet) },
          ...term.ancestors.map(ancestor => ({
            label: ancestor.display_name,
            to: categoryPath(ancestor.slug),
          })),
        ],
        current: term.display_name,
      }}
      {...(reading
        ? {
            infobox: <TermInfobox term={term} />,
            categories: [
              ...term.ancestors.map(ancestor => ({
                label: ancestor.display_name,
                to: categoryPath(ancestor.slug),
                prefix: `${facetLabel}:`,
              })),
              {
                label: term.display_name,
                to: path,
                prefix: `${facetLabel}:`,
                current: true,
              },
            ],
            licence: <LicenceLine historyPath={`${path}/history`} />,
          }
        : {})}
    >
      {reading && description ? <UserMarkdown tree={description} /> : null}
      {reading ? <Subcategories term={term} /> : null}
      <Outlet />
    </EntityPage>
  );
}

/**
 * The category couldn't be shown: not found (404), an outage (503), a
 * server error or an answer we couldn't read, inside the shell.
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
