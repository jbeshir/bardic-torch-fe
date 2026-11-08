import {
  Outlet,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ServerError } from "~/components/ErrorPages";
import type { PieceView } from "~/components/piece/PiecePage";
import { failureMeta, ignoreSearchChanges } from "~/catalogue/entity-route";
import { catalogueHeaders } from "~/catalogue/headers";
import { pieceSubtitle } from "~/catalogue/piece";
import {
  NOT_FOUND,
  throwPageFailure,
  thrownPageFailure,
} from "~/catalogue/read-failure";
import { pageMeta } from "~/catalogue/seo";
import { pieceStructuredData } from "~/catalogue/structured-data";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import { getPiece } from "~/server/catalogue.server";
import { renderMarkdown } from "~/server/markdown.server";

/**
 * `/pieces/:slug`, a piece (plan §4.5): the layout of its views, Read
 * (`pieces.$slug._index.tsx`) and History. It loads the piece once
 * for both; moving between history pages (a search-only change) doesn't
 * load it again.
 *
 * A slug that can't be one is our own 404, without asking the API. A
 * failed read is thrown to the ErrorBoundary below, inside the shell: not
 * found (404), the resting page (503), a server error (500) or an answer
 * we couldn't read (502).
 */

const WHAT = "this piece";
const MISSING = "that piece";

export const headers = catalogueHeaders;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  if (!isSlug(slug)) throwPageFailure(NOT_FOUND);
  const result = await getPiece(context, slug);
  if (!result.ok) throwPageFailure(result.failure);
  const piece = result.data;
  // The Markdown is parsed here, on the server: the browser gets the trees.
  const view: PieceView = {
    piece,
    markdown: {
      notes: renderMarkdown(piece.notes_md),
      versions: renderMarkdown(piece.version_notes_md),
      historicalSource: renderMarkdown(piece.historical_source_md),
      licensingNotes: renderMarkdown(piece.licensing_notes_md),
    },
  };
  return view;
}

/** Only a new address loads it again, not a new history page. */
export const shouldRevalidate = ignoreSearchChanges;

export const meta: MetaFunction = args => {
  // The loader's answer: an error, if any, is handled first.
  const loaded = args.loaderData as PieceView | undefined;
  if (args.error || !loaded) return failureMeta(args.error, WHAT, MISSING);
  const { piece } = loaded;
  // A restricted piece isn't to be spread further: kept out of search
  // results, with nothing for a crawler to follow or describe.
  const restricted = piece.conservation_status === "restricted";
  return pageMeta(args, {
    title: piece.title,
    description: `${piece.title}: ${pieceSubtitle(piece).toLowerCase()} in the Bardic Torch catalogue, with its credits, origin, conservation status and where to find it.`,
    path: `/pieces/${piece.slug}`,
    robots: restricted ? "noindex, nofollow" : undefined,
    structuredData: restricted ? undefined : pieceStructuredData(piece),
  });
};

export default function PieceLayout() {
  const view = useLoaderData<typeof loader>();
  return <Outlet context={view} />;
}

/**
 * The piece couldn't be shown: not found, an outage (the resting page,
 * 503), a server error or an answer we couldn't read, inside the shell.
 * Anything else is a bug, reported and shown as "We couldn’t load this
 * piece".
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
