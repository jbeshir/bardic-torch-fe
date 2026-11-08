import type { RouterContextProvider } from "react-router";
import { HELP_HREF, HELP_PAGES, helpHref } from "~/constants/navigation";
import { categoryPath } from "~/catalogue/term-page";
import {
  listCollections,
  listEvents,
  listPersons,
  listPieces,
  listTerms,
  type ReadResult,
} from "~/server/catalogue.server";

/**
 * The sitemaps: an index of `/sitemap/{name}.xml`, each a
 * `urlset`. The catalogue's paged lists are read in full, 100 at a time
 * (the API's limit): the first page gives `total`, then the rest in
 * parallel batches, up to offset 10,000 (the API's greatest), so a sitemap
 * costs at most 101 API calls and lists at most 10,100 entries; a longer
 * list is logged as cut short. The categories are one unpaged read.
 */

const PAGE_SIZE = 100;
const BATCH_SIZE = 6;
/** The API's greatest offset: later entries aren't listed. */
const MAX_OFFSET = 10_000;
/** How long a client waits before asking again after a failed read. */
const RETRY_AFTER_SECONDS = 60;

const NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';

/** The sitemaps, in the index's order. */
const SITEMAP_NAMES = [
  "pages",
  "pieces",
  "bards",
  "categories",
  "collections",
  "events",
] as const;
type SitemapName = (typeof SITEMAP_NAMES)[number];

/** The pages that aren't a catalogue entry: the home page, help and directories. */
const PAGE_PATHS: readonly string[] = [
  "/",
  HELP_HREF,
  ...HELP_PAGES.map(({ slug }) => helpHref(slug)),
  "/pieces",
  "/bards",
  "/categories",
  "/collections",
  "/events",
];

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** `/sitemap.xml`: the index. */
export function sitemapIndex(origin: string): Response {
  const entries = SITEMAP_NAMES.map(
    name => `<sitemap><loc>${origin}/sitemap/${name}.xml</loc></sitemap>`
  );
  return xmlResponse(
    `${XML_HEAD}\n<sitemapindex xmlns="${NAMESPACE}">\n${entries.join("\n")}\n</sitemapindex>\n`
  );
}

function urlset(origin: string, paths: readonly string[]): Response {
  const entries = paths.map(
    path => `<url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`
  );
  return xmlResponse(
    `${XML_HEAD}\n<urlset xmlns="${NAMESPACE}">\n${entries.join("\n")}\n</urlset>\n`
  );
}

type Page<T> = { readonly data: readonly T[]; readonly total: number };

/** Every entry of a list: the first page, then the others in batches. */
async function readAll<T>(
  read: (offset: number) => Promise<ReadResult<Page<T>>>
): Promise<ReadResult<readonly T[]>> {
  const first = await read(0);
  if (!first.ok) return first;
  const { total } = first.data;
  const offsets: number[] = [];
  for (
    let offset = PAGE_SIZE;
    offset < total && offset <= MAX_OFFSET;
    offset += PAGE_SIZE
  ) {
    offsets.push(offset);
  }
  if (total > MAX_OFFSET + PAGE_SIZE) {
    console.warn(
      `A sitemap lists the first ${MAX_OFFSET + PAGE_SIZE} of ${total} entries: the API reads no further.`
    );
  }
  const entries: T[] = [...first.data.data];
  for (let start = 0; start < offsets.length; start += BATCH_SIZE) {
    const batch = await Promise.all(
      offsets.slice(start, start + BATCH_SIZE).map(read)
    );
    for (const page of batch) {
      if (!page.ok) return page;
      entries.push(...page.data.data);
    }
  }
  return { ok: true, data: entries };
}

function unavailable(retryAfter: number): Response {
  return new Response("The sitemap can’t be built right now.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store",
    },
  });
}

function isSitemapName(name: string): name is SitemapName {
  return SITEMAP_NAMES.some(known => known === name);
}

/** The paths of one catalogue sitemap, read from the API. */
function catalogueSitemapPaths(
  context: Readonly<RouterContextProvider>,
  name: Exclude<SitemapName, "pages">
): Promise<ReadResult<readonly string[]>> {
  const paths = <T>(
    result: ReadResult<readonly T[]>,
    path: (entry: T) => readonly string[]
  ): ReadResult<readonly string[]> =>
    result.ok ? { ok: true, data: result.data.flatMap(path) } : result;
  switch (name) {
    case "pieces":
      return readAll(offset =>
        listPieces(context, { limit: PAGE_SIZE, offset })
      ).then(result =>
        paths(result, piece =>
          piece.conservation_status === "restricted"
            ? []
            : [`/pieces/${encodeURIComponent(piece.slug)}`]
        )
      );
    case "bards":
      return readAll(offset =>
        listPersons(context, { limit: PAGE_SIZE, offset })
      ).then(result =>
        paths(result, person =>
          person.is_stub ? [] : [`/bards/${encodeURIComponent(person.slug)}`]
        )
      );
    case "categories":
      return listTerms(context, {}).then(result =>
        paths(
          result.ok ? { ok: true, data: result.data.data } : result,
          term => [categoryPath(encodeURIComponent(term.slug))]
        )
      );
    case "collections":
      return readAll(offset =>
        listCollections(context, { limit: PAGE_SIZE, offset })
      ).then(result =>
        paths(result, collection => [`/collections/${collection.id}`])
      );
    case "events":
      return readAll(offset =>
        listEvents(context, { limit: PAGE_SIZE, offset })
      ).then(result =>
        paths(result, event => [`/events/${encodeURIComponent(event.slug)}`])
      );
  }
}

/**
 * `/sitemap/{type}`, where `type` is `{name}.xml`: restricted pieces and
 * stub persons are left out (a restricted piece asks not to be shared; a
 * person without a page can't be told apart from a stub in a list). Any
 * failed read is a 503 for the whole sitemap.
 */
export async function sitemap(
  context: Readonly<RouterContextProvider>,
  origin: string,
  type: string | undefined
): Promise<Response> {
  const name = type?.endsWith(".xml") ? type.slice(0, -".xml".length) : "";
  if (!isSitemapName(name)) {
    return new Response("Not Found", { status: 404 });
  }
  if (name === "pages") return urlset(origin, PAGE_PATHS);

  const result = await catalogueSitemapPaths(context, name);
  if (!result.ok) {
    return unavailable(
      result.failure.kind === "resting"
        ? result.failure.retryAfter
        : RETRY_AFTER_SECONDS
    );
  }
  return urlset(origin, result.data);
}
