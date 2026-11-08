import type { components } from "../../../app/api/schema.gen";
import { errorBody, type FixtureResponse } from "../operations";
import {
  declaredErrorStatuses,
  specRoute,
  type ParameterSchema,
  type SpecParameter,
} from "../spec";

/**
 * The strict request parser for the 17 public catalogue reads, mirroring the
 * backend's rules (`api/openapi.yaml`, and the API docs' notes for FE2). It
 * is table-driven: each operation's path and query parameters, and their
 * schemas, come from the spec, and a schema the parser doesn't understand
 * throws when this module loads, so a spec change can't be half-mirrored.
 *
 * Every failure is a 400 `invalid_request`:
 * - a path slug that doesn't match the slug pattern or is over 191
 *   characters; an id that isn't a canonical positive int64;
 * - a query string that isn't validly percent-encoded (or isn't UTF-8);
 * - a scalar parameter given more than once;
 * - a value that isn't one of its enum's, a repeated value where the spec
 *   says `uniqueItems`, or more values than `maxItems` (a repeated `term`
 *   counts once);
 * - a `stub` other than `true`/`false`, a `limit` or `offset` that isn't
 *   canonical decimal or is out of range, a `q` that is blank or over 200
 *   code points, a `letter` that isn't A–Z or 0;
 * - `sort=relevance` without `q`;
 * - a `term` no public piece term has (unknown, unapproved, or an
 *   affiliation): "unknown term: <slug>"; an `affiliation` no public
 *   affiliation term has: "unknown affiliation: <slug>".
 *
 * Unknown query parameters are ignored, as the backend ignores them. A path
 * parameter containing `/` (a raw `%2F`) never gets here: the router
 * answers 404 "no such route" for it.
 */

type Schemas = components["schemas"];
type Facet = Schemas["Facet"];
type ErrorCode = Schemas["Error"]["code"];

const CATALOGUE_READ_IDS = [
  "listPieces",
  "getPiece",
  "listPersons",
  "getPerson",
  "listTerms",
  "getTerm",
  "listCollections",
  "getCollection",
  "listEvents",
  "getEvent",
  "listPieceRevisions",
  "listPersonRevisions",
  "listTermRevisions",
  "listCollectionRevisions",
  "listEventRevisions",
  "getRevision",
  "listNeedsWork",
] as const;

export type CatalogueReadId = (typeof CATALOGUE_READ_IDS)[number];

/** Checks one value; answers the error message, or null when it is valid. */
type ValueRule = (value: string) => string | null;

type QueryRule = {
  readonly name: string;
  readonly repeatable: boolean;
  readonly maxItems: number;
  readonly uniqueItems: boolean;
  readonly value: ValueRule;
};

type CatalogueRead = {
  readonly path: string;
  readonly pathRules: readonly { name: string; value: ValueRule }[];
  readonly queryRules: readonly QueryRule[];
  /** The code each declared error status answers with. */
  readonly errors: Readonly<Record<number, readonly ErrorCode[]>>;
};

const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
/** The `Search` parameter's "not only ASCII blanks" pattern. */
const NOT_BLANK_PATTERN = "[^ \\t\\n\\f\\r]";
const INT64_MAX = 9223372036854775807n;
const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;

/** The error code each status the catalogue reads declare answers with. */
const STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  400: "invalid_request",
  404: "not_found",
  500: "internal",
};

const codePoints = (value: string) => [...value].length;

function unsupported(name: string): never {
  throw new Error(`The fixture can't parse the parameter ${name}`);
}

function integerRule(name: string, schema: ParameterSchema): ValueRule {
  const minimum = BigInt(schema.minimum ?? unsupported(name));
  const maximum =
    schema.maximum !== undefined
      ? BigInt(schema.maximum)
      : schema.format === "int64"
        ? INT64_MAX
        : unsupported(name);
  const message = `invalid ${name}: must be an integer from ${minimum} to ${maximum}`;
  return value => {
    if (!CANONICAL_DECIMAL.test(value)) return message;
    const number = BigInt(value);
    return number < minimum || number > maximum ? message : null;
  };
}

function stringRule(name: string, schema: ParameterSchema): ValueRule {
  const pattern = new RegExp(schema.pattern ?? unsupported(name), "u");
  const maxLength = schema.maxLength ?? unsupported(name);
  if (schema.pattern === SLUG_PATTERN) {
    const message = `invalid ${name}: must be lowercase ASCII letters and digits, in runs joined by single hyphens, at most ${maxLength} characters`;
    return value =>
      pattern.test(value) && value.length <= maxLength ? null : message;
  }
  if (schema.pattern === NOT_BLANK_PATTERN) {
    const minLength = schema.minLength ?? unsupported(name);
    const message = `invalid ${name}: must be ${minLength} to ${maxLength} characters, not only spaces, tabs or line breaks`;
    return value => {
      const length = codePoints(value);
      return pattern.test(value) && length >= minLength && length <= maxLength
        ? null
        : message;
    };
  }
  return unsupported(name);
}

function valueRule(name: string, schema: ParameterSchema): ValueRule {
  if (schema.enum) {
    const allowed = new Set(schema.enum);
    return value =>
      allowed.has(value)
        ? null
        : `invalid ${name}: not one of its allowed values`;
  }
  switch (schema.type) {
    case "boolean":
      return value =>
        value === "true" || value === "false"
          ? null
          : `invalid ${name}: must be true or false`;
    case "integer":
      return integerRule(name, schema);
    case "string":
      return stringRule(name, schema);
    default:
      return unsupported(name);
  }
}

function queryRule({ name, repeatable, schema }: SpecParameter): QueryRule {
  if (!repeatable) {
    return {
      name,
      repeatable,
      maxItems: 1,
      uniqueItems: true,
      value: valueRule(name, schema),
    };
  }
  return {
    name,
    repeatable,
    maxItems: schema.maxItems ?? unsupported(name),
    uniqueItems: schema.uniqueItems === true,
    value: valueRule(name, schema.items ?? unsupported(name)),
  };
}

function catalogueRead(operationId: CatalogueReadId): CatalogueRead {
  const { method, path, parameters } = specRoute(operationId);
  if (method !== "GET") throw new Error(`${operationId} is not a GET`);
  const errors = Object.fromEntries(
    declaredErrorStatuses(operationId).map(status => {
      const code = STATUS_CODES[status];
      if (!code) throw new Error(`${operationId} declares ${status}`);
      return [status, [code]];
    })
  );
  return {
    path,
    pathRules: parameters
      .filter(parameter => parameter.in === "path")
      .map(({ name, schema }) => ({ name, value: valueRule(name, schema) })),
    queryRules: parameters
      .filter(parameter => parameter.in === "query")
      .map(queryRule),
    errors,
  };
}

/** The public catalogue reads: path template, parameter rules and errors. */
export const CATALOGUE_READS: Readonly<Record<CatalogueReadId, CatalogueRead>> =
  Object.fromEntries(
    CATALOGUE_READ_IDS.map(operationId => [
      operationId,
      catalogueRead(operationId),
    ])
  ) as Record<CatalogueReadId, CatalogueRead>;

export function isCatalogueRead(value: string): value is CatalogueReadId {
  return Object.hasOwn(CATALOGUE_READS, value);
}

/**
 * Decodes a query string strictly, as the backend does: `+` is a space, and
 * a bad percent-encoding or one that isn't UTF-8 is an error (null).
 * Empty `&&` segments are skipped; a pair without `=` has an empty value.
 */
function decodeQuery(search: string): URLSearchParams | null {
  const query = new URLSearchParams();
  const raw = search.startsWith("?") ? search.slice(1) : search;
  for (const pair of raw.split("&")) {
    if (pair === "") continue;
    const equals = pair.indexOf("=");
    const [name, value] =
      equals === -1
        ? [pair, ""]
        : [pair.slice(0, equals), pair.slice(equals + 1)];
    try {
      query.append(
        decodeURIComponent(name.replaceAll("+", " ")),
        decodeURIComponent(value.replaceAll("+", " "))
      );
    } catch {
      return null;
    }
  }
  return query;
}

/** The facet of the public (approved) term with this slug, if there is one. */
export type TermFacet = (slug: string) => Facet | undefined;

/** Rules that need the catalogue, or more than one parameter. */
function semanticProblem(
  query: URLSearchParams,
  termFacet: TermFacet
): string | null {
  for (const slug of new Set(query.getAll("term"))) {
    const facet = termFacet(slug);
    if (facet === undefined || facet === "affiliation") {
      return `unknown term: ${slug}`;
    }
  }
  const affiliation = query.get("affiliation");
  if (affiliation !== null && termFacet(affiliation) !== "affiliation") {
    return `unknown affiliation: ${affiliation}`;
  }
  if (query.get("sort") === "relevance" && !query.has("q")) {
    return "invalid sort: relevance needs q";
  }
  return null;
}

function queryProblem(
  rule: QueryRule,
  values: readonly string[]
): string | null {
  if (!rule.repeatable && values.length > 1) {
    return `invalid ${rule.name}: given more than once`;
  }
  for (const value of values) {
    const problem = rule.value(value);
    if (problem) return problem;
  }
  const distinct = new Set(values);
  if (rule.uniqueItems && distinct.size < values.length) {
    return `invalid ${rule.name}: a value is given more than once`;
  }
  if (distinct.size > rule.maxItems) {
    return `invalid ${rule.name}: at most ${rule.maxItems} values`;
  }
  return null;
}

type ParsedRequest =
  | { readonly ok: true; readonly query: URLSearchParams }
  | { readonly ok: false; readonly response: FixtureResponse };

/**
 * Validates a public read's decoded path parameters and raw query string
 * (`?…` or empty). Answers the decoded query, or the 400 to send. Rules
 * whose parameter the operation doesn't declare don't apply: `term`,
 * `affiliation` and `sort` are only read where the spec lists them.
 */
export function parseCatalogueRequest(
  operationId: CatalogueReadId,
  params: Readonly<Record<string, string>>,
  search: string,
  termFacet: TermFacet
): ParsedRequest {
  const read = CATALOGUE_READS[operationId];
  const invalid = (message: string): ParsedRequest => ({
    ok: false,
    response: { status: 400, body: errorBody("invalid_request", message) },
  });

  for (const rule of read.pathRules) {
    const problem = rule.value(params[rule.name] ?? "");
    if (problem) return invalid(problem);
  }
  const decoded = decodeQuery(search);
  if (!decoded) {
    return invalid("invalid query string: not validly percent-encoded");
  }
  const query = new URLSearchParams();
  for (const rule of read.queryRules) {
    const values = decoded.getAll(rule.name);
    const problem = queryProblem(rule, values);
    if (problem) return invalid(problem);
    for (const value of values) query.append(rule.name, value);
  }
  const problem = semanticProblem(query, termFacet);
  return problem ? invalid(problem) : { ok: true, query };
}
