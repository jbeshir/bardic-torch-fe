import type { components } from "../../../app/api/schema.gen";

/**
 * The raw term records of the fixture catalogue. Everything here is invented;
 * the facets, the vocabulary and the tree shapes follow the real wiki's
 * categories (PLAN §7.3), nothing else does.
 *
 * Listed in tree order (facets in the spec's order, parents before children,
 * siblings in order), which is the order they are served in.
 */

type Schemas = components["schemas"];

export type RawTerm = Readonly<
  Pick<
    Schemas["Term"],
    "slug" | "facet" | "name" | "display_name" | "description_md"
  > & {
    /** The parent's slug, or null for a root. */
    parent: string | null;
    /** The affiliation this term relates to, by slug. */
    related_affiliation: string | null;
  }
>;

type Facet = Schemas["Facet"];

interface TermOptions {
  readonly parent?: string;
  /** The full name when it carries a disambiguation suffix. */
  readonly name?: string;
  readonly description?: string;
  readonly relatedAffiliation?: string;
}

function term(
  facet: Facet,
  slug: string,
  displayName: string,
  options: TermOptions = {}
): RawTerm {
  return {
    slug,
    facet,
    name: options.name ?? displayName,
    display_name: displayName,
    description_md: options.description ?? null,
    parent: options.parent ?? null,
    related_affiliation: options.relatedAffiliation ?? null,
  };
}

export const TERMS: readonly RawTerm[] = [
  // Mood.
  term("mood", "warlike", "Warlike"),
  term("mood", "comedic", "Comedic"),
  term("mood", "sentimental", "Sentimental"),
  term("mood", "joyful", "Joyful"),
  term("mood", "singalong", "Singalong"),
  term("mood", "tragic", "Tragic"),
  term("mood", "story-mood", "Story", { name: "Story (Mood)" }),
  term("mood", "eerie", "Eerie"),
  term("mood", "relaxed", "Relaxed"),
  term("mood", "rude", "Rude"),
  term("mood", "leaving-songs", "Leaving songs"),
  term("mood", "romantic", "Romantic"),
  term("mood", "comforting", "Comforting"),

  // Topic: three deep trees, and a handful of roots.
  term("topic", "war", "War", {
    description: "Pieces about fighting, sieges and the people who fought.",
  }),
  term("topic", "battles", "Battles", { parent: "war" }),
  term("topic", "swords", "Swords", { parent: "battles" }),
  term("topic", "sca", "SCA"),
  term("topic", "sca-peerage-pieces", "SCA peerage pieces", {
    parent: "sca",
    relatedAffiliation: "northmarch",
  }),
  term("topic", "squires", "Squires", { parent: "sca-peerage-pieces" }),
  term("topic", "historical-people-and-events", "Historical people and events"),
  term("topic", "12th-century-topic", "12th Century", {
    name: "12th Century (Topic)",
  }),
  term("topic", "love", "Love"),
  term("topic", "drinking", "Drinking"),
  term("topic", "virtues", "Virtues"),
  term("topic", "death", "Death"),
  term("topic", "wandering", "Wandering"),

  // Culture.
  term("culture", "english", "English"),
  term("culture", "gaelic", "Gaelic"),
  term("culture", "norse", "Norse"),
  term("culture", "french", "French"),
  term("culture", "welsh", "Welsh", { name: "Welsh (Culture)" }),
  term("culture", "spanish", "Spanish"),

  // Language.
  term("language", "middle-english", "Middle English"),
  term("language", "welsh-language", "Welsh", { name: "Welsh (Language)" }),
  term("language", "portuguese", "Portuguese"),
  term("language", "asl", "ASL"),

  // Legendaria.
  term("legendaria", "fenian-cycle", "Fenian Cycle"),
  term("legendaria", "arthuriana", "Arthuriana"),

  // Origin.
  term("origin", "sca-pieces", "SCA pieces"),
  term("origin", "traditional-and-folk", "Traditional and folk"),
  term("origin", "pre-1600-sources", "Pre-1600 sources"),
  term("origin", "contrafacta", "Contrafacta"),
  term("origin", "contrafacta-modern", "Modern", {
    parent: "contrafacta",
    name: "Modern (Contrafacta)",
  }),
  term("origin", "contrafacta-sca", "SCA", {
    parent: "contrafacta",
    name: "SCA (Contrafacta)",
  }),
  term("origin", "12th-century", "12th Century", {
    name: "12th Century (Origin)",
  }),
  term("origin", "13th-century", "13th Century"),
  term("origin", "16th-century", "16th Century"),
  term("origin", "18th-century", "18th Century"),
  term("origin", "20th-century", "20th Century"),

  // Other: its one root has no pieces.
  term("other", "miscellany", "Miscellany"),

  // Affiliation: invented kingdoms, with children.
  term("affiliation", "northmarch", "Northmarch"),
  term("affiliation", "barony-of-ashdown", "Barony of Ashdown", {
    parent: "northmarch",
  }),
  term("affiliation", "westerfell", "Westerfell"),
  term("affiliation", "shire-of-greywater", "Shire of Greywater", {
    parent: "westerfell",
  }),
  term("affiliation", "caer-wyn", "Caer Wyn"),
];

const BY_SLUG: ReadonlyMap<string, RawTerm> = new Map(
  TERMS.map(t => [t.slug, t])
);

/** The term with this slug; throws for a slug that isn't in the catalogue. */
export function rawTerm(slug: string): RawTerm {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`no such term: ${slug}`);
  return found;
}

/** A term as other entities refer to it. */
export function termSummary(slug: string): Schemas["TermSummary"] {
  const { facet, display_name } = rawTerm(slug);
  return { slug, facet, display_name };
}
