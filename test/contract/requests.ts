/**
 * Catalogue requests for the fixture's strict parser
 * (test/fixture-api/catalogue/query.ts), which mirrors the backend's
 * request rules. The fixture and server tests send every one, through the
 * router and over HTTP.
 */

type InvalidRequest = {
  readonly name: string;
  readonly path: string;
  /** The 400 `invalid_request` message. */
  readonly message: string;
};

const SLUG_RULE =
  "must be lowercase ASCII letters and digits, in runs joined by single hyphens, at most 191 characters";
const ID_RULE = "must be an integer from 1 to 9223372036854775807";
const LIMIT_RULE = "invalid limit: must be an integer from 1 to 100";
const OFFSET_RULE = "invalid offset: must be an integer from 0 to 10000";
const Q_RULE =
  "invalid q: must be 1 to 200 characters, not only spaces, tabs or line breaks";
const NOT_ALLOWED = "not one of its allowed values";
const BAD_ENCODING = "invalid query string: not validly percent-encoded";

/** 21 distinct valid slugs: one more `term` than the backend takes. */
const TWENTY_ONE_TERMS = Array.from(
  { length: 21 },
  (_, index) => `term=t${index}`
).join("&");

export const INVALID_REQUESTS: readonly InvalidRequest[] = [
  // Path slugs and ids.
  {
    name: "an upper-case slug",
    path: "/v1/pieces/The-Lay",
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "a slug with a double hyphen",
    path: "/v1/persons/wren--vale",
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "a slug with a leading hyphen",
    path: "/v1/events/-revel",
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "a percent-encoded non-ASCII slug",
    path: "/v1/terms/caf%C3%A9",
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "a 192-character slug",
    path: `/v1/pieces/${"a".repeat(192)}`,
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "a history slug with an underscore",
    path: "/v1/pieces/the_lay/history",
    message: `invalid slug: ${SLUG_RULE}`,
  },
  {
    name: "collection id 0",
    path: "/v1/collections/0",
    message: `invalid collection_id: ${ID_RULE}`,
  },
  {
    name: "a collection id with a leading zero",
    path: "/v1/collections/012",
    message: `invalid collection_id: ${ID_RULE}`,
  },
  {
    name: "a negative collection id",
    path: "/v1/collections/-1/history",
    message: `invalid collection_id: ${ID_RULE}`,
  },
  {
    name: "a revision id past int64",
    path: "/v1/revisions/9223372036854775808",
    message: `invalid revision_id: ${ID_RULE}`,
  },
  {
    name: "a fractional revision id",
    path: "/v1/revisions/1.5",
    message: `invalid revision_id: ${ID_RULE}`,
  },

  // Encoding and repetition.
  {
    name: "a bad percent-encoding",
    path: "/v1/pieces?q=%zz",
    message: BAD_ENCODING,
  },
  {
    name: "a q that isn't UTF-8",
    path: "/v1/persons?q=%C3",
    message: BAD_ENCODING,
  },
  {
    name: "a bad percent-encoding in an unknown parameter",
    path: "/v1/events?utm=%E0%A4",
    message: BAD_ENCODING,
  },
  {
    name: "a repeated q",
    path: "/v1/pieces?q=wassail&q=lament",
    message: "invalid q: given more than once",
  },
  {
    name: "a repeated limit",
    path: "/v1/pieces/the-lay/history?limit=10&limit=10",
    message: "invalid limit: given more than once",
  },
  {
    name: "a repeated event kind",
    path: "/v1/events?kind=venue&kind=event",
    message: "invalid kind: given more than once",
  },
  {
    name: "a repeated facet",
    path: "/v1/terms?facet=mood&facet=topic",
    message: "invalid facet: given more than once",
  },
  {
    name: "a comma list of kinds",
    path: "/v1/pieces?kind=song,poem",
    message: `invalid kind: ${NOT_ALLOWED}`,
  },
  {
    name: "a repeated piece kind",
    path: "/v1/pieces?kind=song&kind=song",
    message: "invalid kind: a value is given more than once",
  },
  {
    name: "a repeated conservation status",
    path: "/v1/pieces?conservation_status=endangered&conservation_status=endangered",
    message: "invalid conservation_status: a value is given more than once",
  },
  {
    name: "a repeated role",
    path: "/v1/persons?role=poet&role=poet",
    message: "invalid role: a value is given more than once",
  },
  {
    name: "a repeated collection kind",
    path: "/v1/collections?kind=wiki&kind=wiki",
    message: "invalid kind: a value is given more than once",
  },

  // Enums.
  {
    name: "an unknown piece kind",
    path: "/v1/pieces?kind=ballad",
    message: `invalid kind: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown conservation status",
    path: "/v1/pieces?conservation_status=extinct",
    message: `invalid conservation_status: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown sort",
    path: "/v1/pieces?sort=newest",
    message: `invalid sort: ${NOT_ALLOWED}`,
  },
  {
    name: "the piece sort on persons",
    path: "/v1/persons?sort=title",
    message: `invalid sort: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown person kind",
    path: "/v1/persons?kind=bard",
    message: `invalid kind: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown role",
    path: "/v1/persons?role=minstrel",
    message: `invalid role: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown facet",
    path: "/v1/terms?facet=genre",
    message: `invalid facet: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown collection kind",
    path: "/v1/collections?kind=book",
    message: `invalid kind: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown event kind",
    path: "/v1/events?kind=festival",
    message: `invalid kind: ${NOT_ALLOWED}`,
  },
  {
    name: "an unknown needs-work reason",
    path: "/v1/needs-work?reason=typos",
    message: `invalid reason: ${NOT_ALLOWED}`,
  },
  {
    name: "a lower-case letter",
    path: "/v1/pieces?letter=t",
    message: `invalid letter: ${NOT_ALLOWED}`,
  },
  {
    name: "an accented letter",
    path: "/v1/collections?letter=%C3%89",
    message: `invalid letter: ${NOT_ALLOWED}`,
  },
  {
    name: "two letters",
    path: "/v1/persons?letter=AB",
    message: `invalid letter: ${NOT_ALLOWED}`,
  },
  {
    name: "an empty letter",
    path: "/v1/pieces?letter=",
    message: `invalid letter: ${NOT_ALLOWED}`,
  },

  // Booleans, integers, strings.
  {
    name: "stub=yes",
    path: "/v1/pieces?stub=yes",
    message: "invalid stub: must be true or false",
  },
  {
    name: "stub=TRUE",
    path: "/v1/pieces?stub=TRUE",
    message: "invalid stub: must be true or false",
  },
  { name: "limit=0", path: "/v1/pieces?limit=0", message: LIMIT_RULE },
  { name: "limit=101", path: "/v1/persons?limit=101", message: LIMIT_RULE },
  { name: "limit=+5", path: "/v1/terms/war?limit=%2B5", message: LIMIT_RULE },
  { name: "limit=05", path: "/v1/collections?limit=05", message: LIMIT_RULE },
  { name: "an empty limit", path: "/v1/events?limit=", message: LIMIT_RULE },
  {
    name: "offset=10001",
    path: "/v1/needs-work?offset=10001",
    message: OFFSET_RULE,
  },
  {
    name: "offset=-1",
    path: "/v1/persons/wren/history?offset=-1",
    message: OFFSET_RULE,
  },
  {
    name: "offset=1e3",
    path: "/v1/terms/war/history?offset=1e3",
    message: OFFSET_RULE,
  },
  { name: "an empty q", path: "/v1/pieces?q=", message: Q_RULE },
  { name: "a q of spaces", path: "/v1/persons?q=+%20+", message: Q_RULE },
  {
    name: "a q of tabs and line breaks",
    path: "/v1/pieces?q=%09%0A%0D%0C",
    message: Q_RULE,
  },
  {
    name: "a 201-character q",
    path: `/v1/pieces?q=${"a".repeat(201)}`,
    message: Q_RULE,
  },

  // Terms, affiliations and sort.
  {
    name: "a term that isn't a slug",
    path: "/v1/pieces?term=Swords",
    message: `invalid term: ${SLUG_RULE}`,
  },
  {
    name: "21 terms",
    path: `/v1/pieces?${TWENTY_ONE_TERMS}`,
    message: "invalid term: at most 20 values",
  },
  {
    name: "an unknown term",
    path: "/v1/pieces?term=swords",
    message: "unknown term: swords",
  },
  {
    name: "an affiliation that isn't a slug",
    path: "/v1/persons?affiliation=Northmarch",
    message: `invalid affiliation: ${SLUG_RULE}`,
  },
  {
    name: "a repeated affiliation",
    path: "/v1/persons?affiliation=northmarch&affiliation=westerfell",
    message: "invalid affiliation: given more than once",
  },
  {
    name: "an unknown affiliation",
    path: "/v1/persons?affiliation=northmarch",
    message: "unknown affiliation: northmarch",
  },
  {
    name: "pieces sorted by relevance without q",
    path: "/v1/pieces?sort=relevance",
    message: "invalid sort: relevance needs q",
  },
  {
    name: "persons sorted by relevance without q",
    path: "/v1/persons?sort=relevance&letter=W",
    message: "invalid sort: relevance needs q",
  },
];

/**
 * Requests the parser accepts. Nothing is served for them yet beyond the
 * parser, so each must simply not be a 400.
 */
export const VALID_REQUESTS: readonly { name: string; path: string }[] = [
  {
    name: "every piece filter at its limits",
    path: "/v1/pieces?kind=song&kind=poem&conservation_status=endangered&stub=false&q=rock+and+roll&letter=0&sort=relevance&limit=100&offset=10000",
  },
  {
    name: "unknown parameters, repeated",
    path: "/v1/pieces?utm=a&utm=b&page=2",
  },
  { name: "a 191-character slug", path: `/v1/pieces/${"a".repeat(191)}` },
  {
    name: "a declared parameter of another operation",
    path: "/v1/pieces/the-lay?limit=0",
  },
  {
    name: "a q of no-break spaces",
    path: "/v1/persons?q=%C2%A0%C2%A0",
  },
  {
    name: "a 200-code-point q of astral characters",
    path: `/v1/pieces?q=${encodeURIComponent("𝄞".repeat(200))}`,
  },
  { name: "persons sorted by name", path: "/v1/persons?sort=name" },
  { name: "the largest id", path: "/v1/revisions/9223372036854775807" },
  { name: "a collection's history", path: "/v1/collections/12/history" },
  { name: "the affiliation facet", path: "/v1/terms?facet=affiliation" },
  { name: "every needs-work reason", path: "/v1/needs-work?reason=dead_links" },
  { name: "empty pairs", path: "/v1/events?&&kind=venue&" },
];
