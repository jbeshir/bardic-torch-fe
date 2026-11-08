import { FACET_LABELS } from "~/constants/vocabulary";
import type { TermListItem } from "~/schemas/catalogue";

/**
 * The search page's categories (plan §4.4): `listTerms` has no `q`, so the
 * terms are matched here, the way the API matches a search (api-docs
 * "Search"): case and accents ignored, and every word of the search must
 * start a word of the term's display name, full name or facet label.
 */

/** The letters NFD leaves whole, as the API folds them (PLAN §4.1). */
const LETTER_FOLDS: Readonly<Record<string, string>> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "th",
};

/** Words shorter than this aren't searched for (the API's token size). */
const MIN_WORD = 3;

/**
 * The API's stopwords (InnoDB's defaults), which a search ignores. "and" is
 * not one.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "about",
  "are",
  "com",
  "for",
  "from",
  "how",
  "that",
  "the",
  "this",
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

/** The most categories the search page shows. */
const SHOWN_MAX = 12;

/** Lower case, accents and marks removed, Þ/Æ/ß-style letters spelt out. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-GB")
    .replace(/[łøđðæœßþ]/gu, letter => LETTER_FOLDS[letter] ?? letter);
}

/** The folded words of `text`: runs of letters and digits. */
function words(text: string): readonly string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word !== "");
}

/**
 * The words a search looks for: 3 letters or more, stopwords left out.
 * With none (a search like "Oi" or "the"), the whole search is a prefix
 * of the name instead, as the API falls back to.
 */
function searchWords(q: string): readonly string[] {
  return words(q).filter(
    word => [...word].length >= MIN_WORD && !STOPWORDS.has(word)
  );
}

/** Whether `term` matches the search `q` (see the module comment). */
function matches(term: TermListItem, q: string): boolean {
  const wanted = searchWords(q);
  if (wanted.length === 0) {
    const prefix = fold(q).trim();
    return (
      prefix !== "" &&
      (fold(term.display_name).startsWith(prefix) ||
        fold(term.name).startsWith(prefix))
    );
  }
  const have = [
    ...words(term.display_name),
    ...words(term.name),
    ...words(FACET_LABELS[term.facet]),
  ];
  return wanted.every(word =>
    have.some(candidate => candidate.startsWith(word))
  );
}

export type TermMatches = {
  /** The first matches, in tree order (facets in the API's order). */
  readonly shown: readonly TermListItem[];
  /** How many terms match in all. */
  readonly total: number;
};

/** The terms matching `q`, the first 12 of them in tree order. */
export function searchTerms(
  terms: readonly TermListItem[],
  q: string
): TermMatches {
  const found = terms.filter(term => matches(term, q));
  return { shown: found.slice(0, SHOWN_MAX), total: found.length };
}
