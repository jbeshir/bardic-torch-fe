import { redirect } from "react-router";
import { isSlug, PAGE_SIZE } from "~/schemas/address";
import {
  conservationStatusSchema,
  letterSchema,
  personKindSchema,
  personRoleSchema,
  personSortSchema,
  pieceKindSchema,
  pieceSortSchema,
  type ApiQuery,
  type ConservationStatus,
  type Letter,
  type PersonKind,
  type PersonRole,
  type PersonSort,
  type PieceKind,
  type PieceSort,
} from "~/schemas/catalogue";

/**
 * The URL state of the catalogue's list pages (plan §2): one parser and
 * serialiser per page, built from the shared rules below, pure functions
 * all. Each page's module has
 *
 * - `parse(params)`: the state the URL asks for, with every rule of §2.2
 *   applied, and its `canonical` query string ("?…", or "" for none);
 * - `toApi(state)`: the operation's query object, `limit`/`offset`
 *   computed from `page`;
 * - `href(state, change?)`: the canonical link for `state` with `change`
 *   applied. A change resets `page` to 1 unless it sets `page` itself.
 *
 * A loader parses `url.searchParams`, then calls `redirectIfNotCanonical`,
 * so a URL that means something else (an unknown name, an invalid,
 * repeated or empty value) is answered with one 301 to its canonical form.
 * Links in the page are always `href(…)`, so they never need it.
 *
 * Vocabularies come from `~/schemas/catalogue` (enum order) and
 * `~/schemas/address` (slugs, paging), never retyped here. Add a page's
 * parser with its route.
 */

// ---------------------------------------------------------------------------
// Shared rules (§2.2)

/** The ASCII blanks the API trims and rejects a search of only (A2). */
const BLANK = /^[ \t\n\f\r]+|[ \t\n\f\r]+$/g;

/** The longest search, in code points (the API's `maxLength`). */
const SEARCH_MAX = 200;

/** The most `term`s a search takes (the API's `maxItems`). */
const TERMS_MAX = 20;

/** A decimal page number from 2 to 999,999,999; 1 is the default. */
const PAGE_PATTERN = /^[1-9][0-9]{0,8}$/;

/** An enum value as the URL may write it: any case, with stray spaces. */
function normaliseEnum(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A scalar parameter: the first value `read` accepts (a URL may repeat a
 * name, which the API would answer with a 400), or undefined.
 */
function scalar<T>(
  params: URLSearchParams,
  name: string,
  read: (value: string) => T | undefined
): T | undefined {
  for (const value of params.getAll(name)) {
    const found = read(value);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * A repeatable parameter: each value trimmed and lower-cased, the invalid
 * ones dropped, duplicates removed, then sorted (`order`'s order, or
 * alphabetically when there is none) and cut to `max`.
 */
function repeated<T extends string>(
  params: URLSearchParams,
  name: string,
  {
    order,
    valid,
    max,
  }: {
    readonly valid: (value: string) => value is T;
    readonly order?: readonly T[];
    readonly max?: number;
  }
): readonly T[] {
  const values = [
    ...new Set(params.getAll(name).map(normaliseEnum).filter(valid)),
  ];
  const sorted = order
    ? values.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    : values.sort();
  return max === undefined ? sorted : sorted.slice(0, max);
}

/** A member test for an enum's values. */
function oneOf<T extends string>(values: readonly T[]) {
  return (value: string): value is T =>
    (values as readonly string[]).includes(value);
}

/** `isSlug` as a type guard, for `repeated`. */
function slug(value: string): value is string {
  return isSlug(value);
}

/**
 * `q`: trimmed of ASCII blanks; empty is no search; longer than 200 code
 * points is cut to 200 (and trimmed again, so the cut form is stable).
 * Otherwise kept exactly, case and all.
 */
function searchText(value: string): string | undefined {
  const trimmed = value.replace(BLANK, "");
  const points = [...trimmed];
  const text =
    points.length > SEARCH_MAX
      ? points.slice(0, SEARCH_MAX).join("").replace(BLANK, "")
      : trimmed;
  return text === "" ? undefined : text;
}

/** `letter`: A–Z in either case (upper-cased), or `0`. */
function letter(value: string): Letter | undefined {
  const upper = value.toUpperCase();
  return oneOf(letterSchema.options)(upper) ? upper : undefined;
}

/** `page`: 2 or more in plain decimal; 1, 0 and junk are the first page. */
function pageNumber(value: string): number | undefined {
  if (!PAGE_PATTERN.test(value)) return undefined;
  const page = Number(value);
  return page >= 2 ? page : undefined;
}

/** `true` or `false`, in any case. */
function flag(value: string): boolean | undefined {
  const normalised = normaliseEnum(value);
  if (normalised === "true") return true;
  if (normalised === "false") return false;
  return undefined;
}

/** A parameter of the canonical form: a name and its values, in order. */
type Entry = readonly [
  name: string,
  value: string | readonly string[] | undefined,
];

/**
 * The query string of `entries` ("?…", or "" when none has a value), in
 * their order, encoded as `URLSearchParams` does (a space is `+`).
 */
function serialise(entries: readonly Entry[]): string {
  const params = new URLSearchParams();
  for (const [name, value] of entries) {
    if (value === undefined) continue;
    for (const item of typeof value === "string" ? [value] : value) {
      params.append(name, item);
    }
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** A query string's decoded `[name, value]` pairs, as a sorted multiset. */
function decodedPairs(search: string): string[] {
  return [...new URLSearchParams(search)]
    .map(pair => JSON.stringify(pair))
    .sort();
}

/**
 * Whether the request's query means exactly what `canonical` means: the
 * same decoded `[name, value]` pairs, in any order. So encoding (`~` or
 * `%7E`, `+` or `%20`, the case of percent hex) and order never differ,
 * and a proxy's URL normalisation can't cause a redirect loop.
 */
function isCanonical(search: string, canonical: string): boolean {
  const requested = decodedPairs(search);
  const wanted = decodedPairs(canonical);
  return (
    requested.length === wanted.length &&
    requested.every((pair, index) => pair === wanted[index])
  );
}

/**
 * Answer a URL whose query means something other than its canonical form
 * with a 301 there (§2.2 rule 10). Order-only differences are not
 * redirected: the page answers 200 and names the ordered form in its
 * canonical link. The target is canonical itself, so it is answered 200.
 */
export function redirectIfNotCanonical(url: URL, canonical: string): void {
  if (!isCanonical(url.search, canonical)) {
    throw redirect(`${url.pathname}${canonical}`, 301);
  }
}

/** Rows to skip for `page` (from 1). */
function offsetOf(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

// ---------------------------------------------------------------------------
// /pieces

export type PieceQueryState = {
  readonly q: string | undefined;
  readonly term: readonly string[];
  readonly kind: readonly PieceKind[];
  /** The API's `conservation_status`; `status` in the URL. */
  readonly status: readonly ConservationStatus[];
  readonly stub: boolean | undefined;
  readonly letter: Letter | undefined;
  /** Only a non-default order: `title` with `q` (relevance is the default). */
  readonly sort: PieceSort | undefined;
  /** From 1. */
  readonly page: number;
};

const PIECES_PATH = "/pieces";

/** `sort` kept only where it isn't the default for the state, and is allowed. */
function pieceSort(
  params: URLSearchParams,
  q: string | undefined
): PieceSort | undefined {
  const sort = scalar(params, "sort", value => {
    const normalised = normaliseEnum(value);
    return oneOf(pieceSortSchema.options)(normalised) ? normalised : undefined;
  });
  // Without q, title is the default and relevance is refused (400); with
  // q, relevance is the default.
  return q !== undefined && sort === "title" ? "title" : undefined;
}

function parsePieces(params: URLSearchParams): PieceQueryState {
  const q = scalar(params, "q", searchText);
  return {
    q,
    term: repeated(params, "term", { valid: slug, max: TERMS_MAX }),
    kind: repeated(params, "kind", {
      valid: oneOf(pieceKindSchema.options),
      order: pieceKindSchema.options,
    }),
    status: repeated(params, "status", {
      valid: oneOf(conservationStatusSchema.options),
      order: conservationStatusSchema.options,
    }),
    stub: scalar(params, "stub", flag),
    letter: scalar(params, "letter", letter),
    sort: pieceSort(params, q),
    page: scalar(params, "page", pageNumber) ?? 1,
  };
}

/** The canonical query string of a parsed (so already valid) state. */
function serialisePieces(state: PieceQueryState): string {
  return serialise([
    ["q", state.q],
    ["term", state.term],
    ["kind", state.kind],
    ["status", state.status],
    ["stub", state.stub === undefined ? undefined : String(state.stub)],
    ["letter", state.letter],
    ["sort", state.sort],
    ["page", state.page > 1 ? String(state.page) : undefined],
  ]);
}

/** `/pieces`: the piece browse, search and A–Z (plan §4.2). */
export const pieceQuery = {
  parse(params: URLSearchParams): {
    readonly state: PieceQueryState;
    readonly canonical: string;
  } {
    const state = parsePieces(params);
    return { state, canonical: serialisePieces(state) };
  },

  toApi(state: PieceQueryState): ApiQuery<"listPieces"> {
    return {
      ...(state.term.length > 0 ? { term: state.term } : {}),
      ...(state.kind.length > 0 ? { kind: state.kind } : {}),
      ...(state.status.length > 0 ? { conservation_status: state.status } : {}),
      ...(state.stub === undefined ? {} : { stub: state.stub }),
      ...(state.q === undefined ? {} : { q: state.q }),
      ...(state.letter === undefined ? {} : { letter: state.letter }),
      ...(state.sort === undefined ? {} : { sort: state.sort }),
      limit: PAGE_SIZE,
      offset: offsetOf(state.page),
    };
  },

  href(state: PieceQueryState, change: Partial<PieceQueryState> = {}): string {
    const next: PieceQueryState = {
      ...state,
      page: 1,
      ...change,
    };
    // Re-parsed, so a change that makes another value moot (no q, so no
    // sort) still gives the canonical form.
    const params = new URLSearchParams(serialisePieces(next));
    return `${PIECES_PATH}${pieceQuery.parse(params).canonical}`;
  },
};

// ---------------------------------------------------------------------------
// /bards (C5.2)

export type PersonQueryState = {
  readonly q: string | undefined;
  readonly kind: readonly PersonKind[];
  readonly role: readonly PersonRole[];
  /** One affiliation term's slug. */
  readonly affiliation: string | undefined;
  readonly letter: Letter | undefined;
  /** Only a non-default order: `name` with `q` (relevance is the default). */
  readonly sort: PersonSort | undefined;
  /** From 1. */
  readonly page: number;
};

const BARDS_PATH = "/bards";

function parsePersons(params: URLSearchParams): PersonQueryState {
  const q = scalar(params, "q", searchText);
  const sort = scalar(params, "sort", value => {
    const normalised = normaliseEnum(value);
    return oneOf(personSortSchema.options)(normalised) ? normalised : undefined;
  });
  return {
    q,
    kind: repeated(params, "kind", {
      valid: oneOf(personKindSchema.options),
      order: personKindSchema.options,
    }),
    role: repeated(params, "role", {
      valid: oneOf(personRoleSchema.options),
      order: personRoleSchema.options,
    }),
    affiliation: scalar(params, "affiliation", value => {
      const normalised = normaliseEnum(value);
      return isSlug(normalised) ? normalised : undefined;
    }),
    letter: scalar(params, "letter", letter),
    // As for pieces: name is the default without q, relevance with it.
    sort: q !== undefined && sort === "name" ? "name" : undefined,
    page: scalar(params, "page", pageNumber) ?? 1,
  };
}

function serialisePersons(state: PersonQueryState): string {
  return serialise([
    ["q", state.q],
    ["kind", state.kind],
    ["role", state.role],
    ["affiliation", state.affiliation],
    ["letter", state.letter],
    ["sort", state.sort],
    ["page", state.page > 1 ? String(state.page) : undefined],
  ]);
}

/** `/bards`: the bards directory, its search and A–Z (plan §4.7). */
export const personQuery = {
  parse(params: URLSearchParams): {
    readonly state: PersonQueryState;
    readonly canonical: string;
  } {
    const state = parsePersons(params);
    return { state, canonical: serialisePersons(state) };
  },

  toApi(state: PersonQueryState): ApiQuery<"listPersons"> {
    return {
      ...(state.kind.length > 0 ? { kind: state.kind } : {}),
      ...(state.role.length > 0 ? { role: state.role } : {}),
      ...(state.affiliation === undefined
        ? {}
        : { affiliation: state.affiliation }),
      ...(state.q === undefined ? {} : { q: state.q }),
      ...(state.letter === undefined ? {} : { letter: state.letter }),
      ...(state.sort === undefined ? {} : { sort: state.sort }),
      limit: PAGE_SIZE,
      offset: offsetOf(state.page),
    };
  },

  href(
    state: PersonQueryState,
    change: Partial<PersonQueryState> = {}
  ): string {
    const next: PersonQueryState = { ...state, page: 1, ...change };
    const params = new URLSearchParams(serialisePersons(next));
    return `${BARDS_PATH}${personQuery.parse(params).canonical}`;
  },
};
