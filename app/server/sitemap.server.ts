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
 * `/sitemap.xml`: one `urlset` of the pages and every public catalogue
 * entry. The paged lists are read in full, 100 at a time (the API's
 * limit); the categories are one unpaged read. Restricted pieces and stub
 * persons are left out (a restricted piece asks not to be shared; a person
 * without a page can't be told apart from a stub in a list). Any failed
 * read is a 503 for the whole sitemap, so an outage never publishes an
 * empty one.
 */

const PAGE_SIZE = 100;
/** How long a client waits before asking again after a failed read. */
const RETRY_AFTER_SECONDS = 60;

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

type Page<T> = { readonly data: readonly T[]; readonly total: number };

/** Every entry of a list, a page at a time. */
async function readAll<T>(
  read: (offset: number) => Promise<ReadResult<Page<T>>>,
  path: (entry: T) => readonly string[]
): Promise<ReadResult<readonly string[]>> {
  const paths: string[] = [];
  for (let offset = 0, total = 1; offset < total; offset += PAGE_SIZE) {
    const page = await read(offset);
    if (!page.ok) return page;
    ({ total } = page.data);
    paths.push(...page.data.data.flatMap(path));
  }
  return { ok: true, data: paths };
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

export async function sitemap(
  context: Readonly<RouterContextProvider>,
  origin: string
): Promise<Response> {
  const parts = await Promise.all([
    readAll(
      offset => listPieces(context, { limit: PAGE_SIZE, offset }),
      piece =>
        piece.conservation_status === "restricted"
          ? []
          : [`/pieces/${encodeURIComponent(piece.slug)}`]
    ),
    readAll(
      offset => listPersons(context, { limit: PAGE_SIZE, offset }),
      person =>
        person.is_stub || person.slug === null
          ? []
          : [`/bards/${encodeURIComponent(person.slug)}`]
    ),
    listTerms(context, {}).then((terms): ReadResult<readonly string[]> =>
      terms.ok
        ? {
            ok: true,
            data: terms.data.data.map(term =>
              categoryPath(encodeURIComponent(term.slug))
            ),
          }
        : terms
    ),
    readAll(
      offset => listCollections(context, { limit: PAGE_SIZE, offset }),
      collection => [`/collections/${collection.id}`]
    ),
    readAll(
      offset => listEvents(context, { limit: PAGE_SIZE, offset }),
      event => [`/events/${encodeURIComponent(event.slug)}`]
    ),
  ]);
  const paths = [...PAGE_PATHS];
  for (const part of parts) {
    if (!part.ok) {
      return unavailable(
        part.failure.kind === "resting"
          ? part.failure.retryAfter
          : RETRY_AFTER_SECONDS
      );
    }
    paths.push(...part.data);
  }
  const entries = paths.map(
    path => `<url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`
  );
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
