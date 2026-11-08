import { PIECE_KIND_LABELS } from "~/constants/vocabulary";
import type { CreditRole, Person, Piece, PieceKind } from "~/schemas/catalogue";
import { isUserUrl } from "./user-url";

/**
 * schema.org descriptions of catalogue pages (plan §4.5, §4.6), emitted as
 * JSON-LD through `pageMeta`'s `structuredData`. Each takes the site's
 * origin for its absolute URLs. A restricted piece and a person who asked
 * not to have a page get none: they aren't to be spread further.
 */

type Credited = NonNullable<Piece["credits"][number]["person"]>;

/** Kinds that are music, described as a MusicComposition. */
const MUSIC: ReadonlySet<PieceKind> = new Set([
  "song",
  "dance_music",
  "instrumental",
]);

/** Credits for the music, rather than the words or the dance. */
const COMPOSING: ReadonlySet<CreditRole> = new Set([
  "tune",
  "music",
  "arrangement",
]);

function personRef(person: Credited, origin: string) {
  return {
    "@type": person.kind === "group" ? "MusicGroup" : "Person",
    name: person.name,
    url: new URL(`/bards/${person.slug}`, origin).href,
  };
}

/**
 * A piece as a CreativeWork, or a MusicComposition when it is music: its
 * title and other names, its kinds as the genre, its named credits (the
 * music's as `composer` on a composition, every other as `author`), its
 * address and its languages.
 */
export function pieceStructuredData(piece: Piece) {
  return (origin: string): Readonly<Record<string, unknown>> => {
    const music = MUSIC.has(piece.kind);
    const named = piece.credits.flatMap(credit =>
      credit.person ? [{ role: credit.role, person: credit.person }] : []
    );
    const composers = music
      ? named.filter(({ role }) => COMPOSING.has(role))
      : [];
    const authors = named.filter(credit => !composers.includes(credit));
    const aliases = piece.aliases
      .filter(({ kind }) => kind !== "redirect")
      .map(({ text }) => text);
    // The API names a language, with no BCP 47 code: a Language by name,
    // never a name where schema.org expects a code.
    const languages = piece.terms
      .filter(({ term }) => term.facet === "language")
      .map(({ term }) => ({ "@type": "Language", name: term.display_name }));
    return {
      "@context": "https://schema.org",
      "@type": music ? "MusicComposition" : "CreativeWork",
      name: piece.title,
      ...(aliases.length > 0 ? { alternateName: aliases } : {}),
      genre: [piece.kind, ...piece.secondary_kinds].map(
        kind => PIECE_KIND_LABELS[kind]
      ),
      ...(authors.length > 0
        ? { author: authors.map(({ person }) => personRef(person, origin)) }
        : {}),
      ...(composers.length > 0
        ? {
            composer: composers.map(({ person }) => personRef(person, origin)),
          }
        : {}),
      url: new URL(`/pieces/${piece.slug}`, origin).href,
      ...(languages.length > 0 ? { inLanguage: languages } : {}),
    };
  };
}

/**
 * A person as a schema.org Person, or a MusicGroup for a group: their
 * name, their other names (never a redirect), their page and, as `sameAs`,
 * their websites and external profiles. Never for a person with no page.
 */
export function personStructuredData(person: Person) {
  return (origin: string): Readonly<Record<string, unknown>> => {
    const profile = person.profile;
    const aliases = (profile?.aliases ?? [])
      .filter(({ kind }) => kind !== "redirect")
      .map(({ name }) => name);
    const sameAs = (profile?.links ?? [])
      .filter(
        link =>
          (link.roles.includes("website") ||
            link.roles.includes("external_profile")) &&
          isUserUrl(link.url)
      )
      .map(link => link.url);
    return {
      "@context": "https://schema.org",
      "@type": person.kind === "group" ? "MusicGroup" : "Person",
      name: person.name,
      ...(aliases.length > 0 ? { alternateName: aliases } : {}),
      url: new URL(`/bards/${person.slug}`, origin).href,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };
  };
}
