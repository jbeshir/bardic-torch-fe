import type { components } from "../../../app/api/schema.gen";

/**
 * The backend's text rules, as the fixture mirrors them (BE PLAN §4.1, the
 * spec's `Search` parameter and the API docs' "Notes for FE2"): accent
 * folding, sort keys and A–Z letters, `q` tokenising and matching, and
 * paging. search.ts and visibility.ts build every list from these.
 */

type Schemas = components["schemas"];
type Letter = Schemas["Letter"];

/** `domain.FoldLetters`: the letters NFKD leaves whole, transliterated. */
const WORD_FOLDS: Readonly<Record<string, string>> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "th",
};

/** The same letters as `sort_letter` places them (ﬁ → F comes from NFKD). */
const LETTER_FOLDS: Readonly<Record<string, Letter>> = {
  Ł: "L",
  Ø: "O",
  Đ: "D",
  Ð: "D",
  Æ: "A",
  Œ: "O",
  ß: "S",
  Þ: "T",
};

/**
 * InnoDB's default stopwords (`INFORMATION_SCHEMA.INNODB_FT_DEFAULT_STOPWORD`).
 * "and" is not one.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "about",
  "an",
  "are",
  "as",
  "at",
  "be",
  "by",
  "com",
  "de",
  "en",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "la",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "who",
  "will",
  "with",
  "und",
  "www",
]);

/** `innodb_ft_min_token_size` and `innodb_ft_max_token_size`. */
const MIN_TOKEN = 3;
const MAX_TOKEN = 84;
/** The API sends at most this many `+token*` terms to MySQL. */
const MAX_TOKENS = 8;

const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const LEADING_THE_A_AN = /^(?:the|a|an)\s+/iu;

const stripMarks = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "");

/** Lower case, accents and combining marks removed, Ł/Ø/Æ-style letters transliterated. */
export function fold(text: string): string {
  return stripMarks(text)
    .toLowerCase()
    .replace(/[łøđðæœßþ]/gu, letter => WORD_FOLDS[letter] ?? letter);
}

/** A title's sort key: leading punctuation and one leading The, A or An skipped. */
export function titleSortKey(title: string): string {
  return title
    .replace(LEADING_PUNCTUATION, "")
    .replace(LEADING_THE_A_AN, "")
    .replace(LEADING_PUNCTUATION, "");
}

/** The A–Z letter a sort key files under: `0` for anything but a Latin letter. */
export function letterOf(sortKey: string): Letter {
  const first = [...stripMarks(sortKey.replace(LEADING_PUNCTUATION, ""))][0];
  if (first === undefined) return "0";
  const folded = LETTER_FOLDS[first] ?? LETTER_FOLDS[first.toUpperCase()];
  if (folded) return folded;
  const upper = first.toUpperCase();
  return /^[A-Z]$/.test(upper) ? (upper as Letter) : "0";
}

const collator = new Intl.Collator("en");

/** Folded, with punctuation dropped, for comparing sort keys. */
const comparable = (key: string) =>
  fold(key)
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

/** Orders sort keys as the backend's collation does: accents, case and punctuation ignored. */
export function compareSortKeys(a: string, b: string): number {
  return collator.compare(comparable(a), comparable(b));
}

/** Every A–Z letter, `0` first: the order letter counts are listed in. */
const LETTERS: readonly Letter[] = [
  "0",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => letter as Letter),
];

/** How many keys file under each letter, `0` first, counts above zero only. */
export function letterCounts(
  sortKeys: readonly string[]
): Schemas["LetterCount"][] {
  const counts = new Map<Letter, number>();
  for (const key of sortKeys) {
    const letter = letterOf(key);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return LETTERS.flatMap(letter => {
    const count = counts.get(letter) ?? 0;
    return count > 0 ? [{ letter, count }] : [];
  });
}

const words = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(word => word !== "");

/**
 * A parsed `q`: the words that must each start a word of the match, or,
 * when no word survives tokenising, a prefix the title or name must start
 * with.
 */
export type SearchQuery =
  | { readonly kind: "words"; readonly tokens: readonly string[] }
  | { readonly kind: "prefix"; readonly prefix: string };

/**
 * Tokenises `q` as the backend does: words are runs of letters, digits and
 * underscores (combining marks removed, accents folded); a word counts if it
 * has a letter or digit, is 3 to 84 characters and isn't a stopword; at
 * most 8 count.
 */
export function parseSearch(q: string): SearchQuery {
  const tokens = words(q)
    .filter(token => {
      const length = [...token].length;
      return (
        /[\p{L}\p{N}]/u.test(token) &&
        length >= MIN_TOKEN &&
        length <= MAX_TOKEN &&
        !STOPWORDS.has(token)
      );
    })
    .slice(0, MAX_TOKENS);
  return tokens.length > 0
    ? { kind: "words", tokens }
    : { kind: "prefix", prefix: fold(q) };
}

/** What a search reads of an entry: its title or name first, then the rest. */
export type Searchable = {
  readonly title: string;
  readonly aliases: readonly string[];
  readonly notes: string | null;
};

/**
 * How well an entry matches, best first: 0 when every word starts a word of
 * the title, 1 when every word starts a word of the title or an alias, 2
 * when they reach into the notes; null for no match. A prefix match ranks
 * 0, so under `relevance` it comes in sort-key order (it has no score).
 */
export function searchRank(
  query: SearchQuery,
  entry: Searchable
): number | null {
  if (query.kind === "prefix") {
    return fold(entry.title).startsWith(query.prefix) ? 0 : null;
  }
  const fields = [
    words(entry.title),
    entry.aliases.flatMap(words),
    words(entry.notes ?? ""),
  ];
  let reached: string[] = [];
  for (const [rank, field] of fields.entries()) {
    reached = [...reached, ...field];
    if (
      query.tokens.every(token => reached.some(word => word.startsWith(token)))
    ) {
      return rank;
    }
  }
  return null;
}

/** One page of `items`, from the request's `limit` (default 50) and `offset`. */
export function page<T>(
  items: readonly T[],
  query: URLSearchParams
): readonly T[] {
  const limit = Number(query.get("limit") ?? 50);
  const offset = Number(query.get("offset") ?? 0);
  return items.slice(offset, offset + limit);
}
