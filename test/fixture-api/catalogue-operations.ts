import { CATALOGUE_READS, type CatalogueReadId } from "./catalogue/query";
import {
  listCollections,
  listEvents,
  listNeedsWork,
  searchPersons,
  searchPieces,
} from "./catalogue/search";
import { page } from "./catalogue/text";
import {
  historyOf,
  publicCollection,
  publicEvent,
  publicPerson,
  publicPiece,
  publicTerm,
  PUBLIC_TERMS,
  serveCollection,
  serveEvent,
  servePerson,
  servePiece,
  serveRevision,
  serveTerm,
  serveTermListItem,
} from "./catalogue/visibility";
import type { FixtureOperation, PublicRequest } from "./operations";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The 17 public catalogue reads, merged into the operation table
 * (operations.ts). The router has already parsed the request strictly
 * (catalogue/query.ts), so a handler reads only valid, declared parameters.
 * Every body comes from visibility.ts and search.ts, so what the backend
 * never serves (hidden links and aliases, unapproved terms and revisions,
 * people who prefer no page) can't leak; the router validates each body
 * against the spec. An unknown or non-public entity is 404 `not_found`.
 */

type Handler = (request: PublicRequest) => FixtureResponse;

const ok = (body: unknown): FixtureResponse => ({ status: 200, body });

const notFound = (entity: string): FixtureResponse => ({
  status: 404,
  body: errorBody("not_found", `${entity} not found`),
});

/** The path parameter; the router always passes the declared ones. */
const param = (request: PublicRequest, name: string) =>
  request.params[name] ?? "";

/** A canonical id as a number; the parser has checked its form. */
const id = (request: PublicRequest, name: string) =>
  Number(param(request, name));

/** Serves an entity found by its path parameter, or 404. */
function detail<T>(
  entity: string,
  find: (request: PublicRequest) => T | undefined,
  serve: (found: T, request: PublicRequest) => unknown
): Handler {
  return request => {
    const found = find(request);
    return found === undefined ? notFound(entity) : ok(serve(found, request));
  };
}

/** One page of an entity's approved revisions, or 404. */
function history(
  entity: string,
  type: Parameters<typeof historyOf>[0],
  key: (request: PublicRequest) => string
): Handler {
  return request => {
    const revisions = historyOf(type, key(request));
    if (revisions === undefined) return notFound(entity);
    return ok({
      data: page(revisions, request.query),
      total: revisions.length,
    });
  };
}

const HANDLERS: Readonly<Record<CatalogueReadId, Handler>> = {
  listPieces: ({ query }) => ok(searchPieces(query)),
  getPiece: detail("piece", r => publicPiece(param(r, "slug")), servePiece),
  listPersons: ({ query }) => ok(searchPersons(query)),
  getPerson: detail("person", r => publicPerson(param(r, "slug")), servePerson),
  listTerms: ({ query }) => {
    const facet = query.get("facet");
    return ok({
      data: PUBLIC_TERMS.filter(t => facet === null || t.facet === facet).map(
        serveTermListItem
      ),
    });
  },
  getTerm: detail(
    "term",
    r => publicTerm(param(r, "slug")),
    (term, { query }) => serveTerm(term, query)
  ),
  listCollections: ({ query }) => ok(listCollections(query)),
  getCollection: detail(
    "collection",
    r => publicCollection(id(r, "collection_id")),
    serveCollection
  ),
  listEvents: ({ query }) => ok(listEvents(query)),
  getEvent: detail("event", r => publicEvent(param(r, "slug")), serveEvent),
  listPieceRevisions: history("piece", "piece", r => param(r, "slug")),
  listPersonRevisions: history("person", "person", r => param(r, "slug")),
  listTermRevisions: history("term", "term", r => param(r, "slug")),
  listCollectionRevisions: history("collection", "collection", r =>
    String(id(r, "collection_id"))
  ),
  listEventRevisions: history("event", "event", r => param(r, "slug")),
  getRevision: detail(
    "revision",
    r => serveRevision(id(r, "revision_id")),
    revision => revision
  ),
  listNeedsWork: ({ query }) => ok(listNeedsWork(query)),
};

export const CATALOGUE_OPERATIONS: Readonly<
  Record<CatalogueReadId, FixtureOperation>
> = Object.fromEntries(
  (Object.keys(HANDLERS) as CatalogueReadId[]).map(operationId => [
    operationId,
    {
      method: "GET",
      path: CATALOGUE_READS[operationId].path,
      hasBody: false,
      authenticated: false,
      errors: CATALOGUE_READS[operationId].errors,
      handle: HANDLERS[operationId],
    } satisfies FixtureOperation,
  ])
) as Record<CatalogueReadId, FixtureOperation>;
