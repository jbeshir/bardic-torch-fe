import type { components } from "../../../app/api/schema.gen";

/**
 * The raw term records of the fixture catalogue. Everything here is invented;
 * the facets, the vocabulary and the tree shapes follow the real wiki's
 * categories (PLAN §7.3), nothing else does.
 *
 * Raw means before redaction: `approved: false` terms and their subtree are
 * never served (`visibility.ts`, C1.5).
 */

type Schemas = components["schemas"];

export type RawTerm = Readonly<
  Pick<
    Schemas["Term"],
    "slug" | "facet" | "name" | "display_name" | "description_md" | "aliases"
  > & {
    /** The parent's slug, or null for a root. */
    parent: string | null;
    /** The affiliation this term relates to, by slug. */
    related_affiliation: string | null;
    /** The order among siblings. */
    position: number;
    approved: boolean;
  }
>;

type Facet = Schemas["Facet"];

interface TermOptions {
  readonly parent?: string;
  /** The full name when it carries a disambiguation suffix. */
  readonly name?: string;
  readonly description?: string;
  readonly aliases?: readonly string[];
  readonly relatedAffiliation?: string;
  readonly approved?: boolean;
}

function term(
  facet: Facet,
  slug: string,
  displayName: string,
  position: number,
  options: TermOptions = {}
): RawTerm {
  return {
    slug,
    facet,
    name: options.name ?? displayName,
    display_name: displayName,
    description_md: options.description ?? null,
    aliases: [...(options.aliases ?? [])],
    parent: options.parent ?? null,
    related_affiliation: options.relatedAffiliation ?? null,
    position,
    approved: options.approved ?? true,
  };
}

/** The slug of the one unapproved topic; its child is `DRAFT_CHILD_SLUG`. */
export const DRAFT_TOPIC_SLUG = "draft-topic";
export const DRAFT_CHILD_SLUG = "draft-topic-child";
/** A facet-root term no piece uses: counted nowhere, listed with 0. */
export const EMPTY_ROOT_SLUG = "miscellany";

export const TERMS: readonly RawTerm[] = [
  // Mood.
  term("mood", "warlike", "Warlike", 1),
  term("mood", "comedic", "Comedic", 2, { aliases: ["Funny"] }),
  term("mood", "sentimental", "Sentimental", 3),
  term("mood", "joyful", "Joyful", 4),
  term("mood", "singalong", "Singalong", 5),
  term("mood", "tragic", "Tragic", 6),
  term("mood", "story-mood", "Story", 7, { name: "Story (Mood)" }),
  term("mood", "eerie", "Eerie", 8),
  term("mood", "relaxed", "Relaxed", 9),
  term("mood", "rude", "Rude", 10),
  term("mood", "leaving-songs", "Leaving songs", 11),
  term("mood", "romantic", "Romantic", 12),
  term("mood", "comforting", "Comforting", 13),

  // Topic: three deep trees, and a handful of roots.
  term("topic", "war", "War", 1, {
    aliases: ["Battle"],
    description: "Pieces about fighting, sieges and the people who fought.",
  }),
  term("topic", "battles", "Battles", 1, { parent: "war" }),
  term("topic", "swords", "Swords", 1, { parent: "battles" }),
  term("topic", "sca", "SCA", 2),
  term("topic", "sca-peerage-pieces", "SCA peerage pieces", 1, {
    parent: "sca",
    relatedAffiliation: "northmarch",
  }),
  term("topic", "squires", "Squires", 1, { parent: "sca-peerage-pieces" }),
  term(
    "topic",
    "historical-people-and-events",
    "Historical people and events",
    3
  ),
  term("topic", "12th-century-topic", "12th Century", 4, {
    name: "12th Century (Topic)",
  }),
  term("topic", "love", "Love", 5),
  term("topic", "drinking", "Drinking", 6),
  term("topic", "virtues", "Virtues", 7),
  term("topic", "death", "Death", 8),
  term("topic", "wandering", "Wandering", 9),
  term("topic", DRAFT_TOPIC_SLUG, "Draft topic", 10, { approved: false }),
  term("topic", DRAFT_CHILD_SLUG, "Draft topic child", 1, {
    parent: DRAFT_TOPIC_SLUG,
    approved: false,
  }),

  // Culture.
  term("culture", "english", "English", 1),
  term("culture", "gaelic", "Gaelic", 2),
  term("culture", "norse", "Norse", 3),
  term("culture", "french", "French", 4),
  term("culture", "welsh", "Welsh", 5, { name: "Welsh (Culture)" }),
  term("culture", "spanish", "Spanish", 6),

  // Language.
  term("language", "middle-english", "Middle English", 1),
  term("language", "welsh-language", "Welsh", 2, { name: "Welsh (Language)" }),
  term("language", "portuguese", "Portuguese", 3),
  term("language", "asl", "ASL", 4, { aliases: ["American Sign Language"] }),

  // Legendaria.
  term("legendaria", "fenian-cycle", "Fenian Cycle", 1),
  term("legendaria", "arthuriana", "Arthuriana", 2),

  // Form.
  term("form", "ballad", "Ballad", 1),
  term("form", "round", "Round", 2),
  term("form", "filk", "Filk", 3),
  term("form", "story-form", "Story", 4, { name: "Story (Form)" }),

  // Origin.
  term("origin", "sca-pieces", "SCA pieces", 1),
  term("origin", "traditional-and-folk", "Traditional and folk", 2),
  term("origin", "pre-1600-sources", "Pre-1600 sources", 3),
  term("origin", "contrafacta", "Contrafacta", 4),
  term("origin", "contrafacta-modern", "Modern", 1, {
    parent: "contrafacta",
    name: "Modern (Contrafacta)",
  }),
  term("origin", "contrafacta-sca", "SCA", 2, {
    parent: "contrafacta",
    name: "SCA (Contrafacta)",
  }),
  term("origin", "12th-century", "12th Century", 5, {
    name: "12th Century (Origin)",
  }),
  term("origin", "13th-century", "13th Century", 6),
  term("origin", "16th-century", "16th Century", 7),
  term("origin", "18th-century", "18th Century", 8),
  term("origin", "20th-century", "20th Century", 9),

  // Other: its one root has no pieces.
  term("other", EMPTY_ROOT_SLUG, "Miscellany", 1),

  // Affiliation: invented kingdoms, with children.
  term("affiliation", "northmarch", "Northmarch", 1),
  term("affiliation", "barony-of-ashdown", "Barony of Ashdown", 1, {
    parent: "northmarch",
  }),
  term("affiliation", "westerfell", "Westerfell", 2),
  term("affiliation", "shire-of-greywater", "Shire of Greywater", 1, {
    parent: "westerfell",
  }),
  term("affiliation", "caer-wyn", "Caer Wyn", 3),
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
