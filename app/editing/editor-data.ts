import type { components } from "~/api/schema.gen";
import type { EntityType } from "./documents";
import type { FieldProblem } from "./problems";

/**
 * What an editor route's loader and action give its page
 * (app/server/editing.server.ts), and what the page links to.
 */

type Schemas = components["schemas"];

/** A picker's choice; `group` heads an `<optgroup>`. */
export type Option = {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
};

/** The public lists a form picks references from. */
export type Picker = "terms" | "affiliations" | "collections";

export type Options = Readonly<Partial<Record<Picker, readonly Option[]>>>;

export type EditorLoaderData<D> = {
  /** Null when the page can't be edited: `notice` says why. */
  readonly document: D | null;
  /** The approved revision an edit is made on; null for a new entity. */
  readonly baseRevisionId: number | null;
  readonly notice: string | null;
  readonly options: Options;
};

export type EditorActionData<D, P> = {
  /** The posted document, to fill the form again; null if unreadable. */
  readonly document: D | null;
  readonly summary: string;
  /** What the type's preview made of the document, after Preview. */
  readonly preview: P | null;
  /** Our copy for a failed submit. */
  readonly message: string | null;
  readonly problems: readonly FieldProblem[];
  /** The public pages a new entity may duplicate (409). */
  readonly duplicates: readonly Schemas["DuplicateMatch"][];
  /** A moderator's edit on a base that has changed since (409). */
  readonly stale: boolean;
};

const READ_PATHS: Readonly<Record<EntityType, string>> = {
  piece: "/pieces",
  person: "/bards",
  term: "/categories",
  collection: "/collections",
  event: "/events",
};

/** An entity's Read page, by its slug (a collection by its id). */
export const readPath = (type: EntityType, key: string | number) =>
  `${READ_PATHS[type]}/${key}`;

/** An editor page's meta: its title, and kept out of search results. */
export const editorMeta = (title: string) => [
  { title: `${title} · Bardic Torch` },
  { name: "robots", content: "noindex" },
];
