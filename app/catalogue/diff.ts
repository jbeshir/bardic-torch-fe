import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  COLLECTION_KIND_LABELS,
  CONSERVATION_LABELS,
  CREDIT_ROLE_LABELS,
  ENUMERABLE_LABELS,
  EVENT_KIND_LABELS,
  FACET_LABELS,
  LICENCE_LABELS,
  LICENSING_STATUS_LABELS,
  LINK_PLACE_TYPE_LABELS,
  LINK_ROLE_LABELS,
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_RELATION_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_STATUS_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
  PIECE_PART_LABELS,
  PIECE_RELATION_LABELS,
} from "~/constants/vocabulary";
import type { Revision } from "~/schemas/catalogue";
import { formatDate } from "./format";
import { isUserUrl } from "./user-url";
import { categoryPath } from "./term-page";
import { wordDiff, type WordPart } from "./word-diff";

/**
 * The changes a revision made (plan §4.11), as plain data for the page to
 * render: one row per changed field, in the page's order (the API's
 * `changed_fields` are alphabetical), each labelled from the entity's field map and diffed by
 * the field's kind:
 *
 * - **scalar** (titles, kinds, flags, years, enums, URLs, references): its
 *   value before and after, each null when there is none (shown "—");
 * - **text** (the Markdown fields): before and after as written, and
 *   word by word when both are set and short enough (`wordDiff`);
 * - **list** (aliases, terms, credits, links, relations, kinds, roles,
 *   affiliations): a keyed set diff, the items added, removed and changed
 *   (the same key with other fields different).
 *
 * A person's `profile` is one field to the API; here it is expanded into
 * a row per sub-field that differs ("Profile: Roles"), with "Identity only"
 * for a side that has none.
 *
 * Links follow §4.0: in a restricted piece's revision (restricted now or
 * in either snapshot) every link is its title or host as text, never an
 * address; so is a person's link that carries performances (spec issue
 * B14: we can't tell whether those pieces were restricted).
 *
 * With no base (`base_snapshot: null`), every row has its value only.
 */

/** One part of a value: text, or a link inside the site or out of it. */
export type DiffValue =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "internal"; readonly to: string; readonly text: string }
  | { readonly kind: "external"; readonly url: string; readonly text: string };

/** A list item: its key, and what it shows, part by part. */
export type DiffItem = {
  readonly key: string;
  readonly parts: readonly DiffValue[];
};

type FieldDiff =
  | {
      readonly kind: "scalar";
      readonly before: readonly DiffValue[] | null;
      readonly after: readonly DiffValue[] | null;
    }
  | {
      readonly kind: "text";
      readonly before: string | null;
      readonly after: string | null;
      /**
       * The two word by word (`wordDiff`), when both are set and within
       * its bounds; null to show them whole.
       */
      readonly words: readonly WordPart[] | null;
    }
  | {
      readonly kind: "list";
      readonly added: readonly DiffItem[];
      readonly removed: readonly DiffItem[];
      readonly changed: readonly {
        readonly before: DiffItem;
        readonly after: DiffItem;
      }[];
    };

export type DiffRow = {
  /** The field's name (and sub-field's), unique in the diff. */
  readonly field: string;
  readonly label: string;
  readonly diff: FieldDiff;
};

export type RevisionChanges = {
  /** No approved base: the rows are the values this revision set. */
  readonly first: boolean;
  /** Links are shown as text only (§4.0). */
  readonly linksAsText: boolean;
  readonly rows: readonly DiffRow[];
};

// ---------------------------------------------------------------------------
// Readings: what one snapshot holds for a field

type Reading =
  | { readonly kind: "scalar"; readonly value: readonly DiffValue[] | null }
  | { readonly kind: "text"; readonly text: string | null }
  | { readonly kind: "list"; readonly items: readonly DiffItem[] };

type Context = {
  /** Every link as text (a restricted piece's revision). */
  readonly linksAsText: boolean;
};

type Field<Snapshot> = {
  readonly label: string;
  readonly read: (snapshot: Snapshot, context: Context) => Reading;
};

type Fields<Snapshot> = { readonly [K in keyof Snapshot]: Field<Snapshot> };

const text = (value: string): DiffValue => ({ kind: "text", text: value });

function scalar(value: DiffValue | null): Reading {
  return { kind: "scalar", value: value === null ? null : [value] };
}

function maybe<T>(value: T | null, show: (value: T) => DiffValue): Reading {
  return scalar(value === null ? null : show(value));
}

function words(value: string | null): Reading {
  return { kind: "text", text: value };
}

function list<T>(
  values: readonly T[],
  key: (value: T) => string,
  parts: (value: T) => readonly (DiffValue | null)[]
): Reading {
  return {
    kind: "list",
    items: values.map(value => ({
      key: key(value),
      parts: parts(value).filter((part): part is DiffValue => part !== null),
    })),
  };
}

/**
 * A label the page uses inside a sentence ("community archive", "alternative
 * title", "probably"), as a value of its own in sentence case: "Community
 * archive".
 */
const standalone = (label: string) =>
  `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

const yesNo = (value: boolean) => text(value ? "Yes" : "No");

/** The host of `url` ("video.example"), or the URL itself if it has none. */
function urlHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * A link's value: an external link to a web address, or (links as text,
 * or any other scheme) its title or host as text, never the address.
 */
function link(url: string, title: string | null, asText: boolean): DiffValue {
  if (asText || !isUserUrl(url)) return text(title ?? urlHost(url));
  return { kind: "external", url, text: title ?? url };
}

const piecePath = (slug: string) => `/pieces/${slug}`;
const personPath = (slug: string) => `/bards/${slug}`;

const termRef = (term: {
  readonly slug: string;
  readonly display_name: string;
}): DiffValue => ({
  kind: "internal",
  to: categoryPath(term.slug),
  text: term.display_name,
});

const pieceRef = (piece: {
  readonly slug: string;
  readonly title: string;
}): DiffValue => ({
  kind: "internal",
  to: piecePath(piece.slug),
  text: piece.title,
});

const personRef = (person: {
  readonly slug: string;
  readonly name: string;
}): DiffValue => ({
  kind: "internal",
  to: personPath(person.slug),
  text: person.name,
});

const count = (n: number, noun: string) =>
  text(`${n} ${noun}${n === 1 ? "" : "s"}`);

/** What a link holds besides its address: roles, place, locator, collection. */
function linkDetails(value: {
  readonly roles: readonly (keyof typeof LINK_ROLE_LABELS)[];
  readonly place_type: keyof typeof LINK_PLACE_TYPE_LABELS | null;
  readonly locator: string | null;
  readonly collection: { readonly id: number; readonly name: string } | null;
  readonly platform: string | null;
  readonly description: string | null;
}): (DiffValue | null)[] {
  return [
    value.roles.length > 0
      ? text(value.roles.map(role => LINK_ROLE_LABELS[role]).join(", "))
      : null,
    value.place_type
      ? text(standalone(LINK_PLACE_TYPE_LABELS[value.place_type]))
      : null,
    value.platform ? text(value.platform) : null,
    value.collection
      ? {
          kind: "internal",
          to: `/collections/${value.collection.id}`,
          text: value.collection.name,
        }
      : null,
    value.locator ? text(value.locator) : null,
    value.description ? text(value.description) : null,
  ];
}

// ---------------------------------------------------------------------------
// The fields of each entity type

type Snapshots = {
  readonly [E in Revision["entity_type"]]: Extract<
    Revision,
    { readonly entity_type: E }
  >["snapshot"];
};

type Profile = NonNullable<Snapshots["person"]["profile"]>;

const PIECE_FIELDS: Fields<Snapshots["piece"]> = {
  title: { label: "Title", read: s => scalar(text(s.title)) },
  kind: { label: "Kind", read: s => scalar(text(PIECE_KIND_LABELS[s.kind])) },
  secondary_kinds: {
    label: "Other kinds",
    read: s =>
      list(
        s.secondary_kinds,
        kind => kind,
        kind => [text(PIECE_KIND_LABELS[kind])]
      ),
  },
  conservation_status: {
    label: "Conservation status",
    read: s => scalar(text(CONSERVATION_LABELS[s.conservation_status])),
  },
  conservation_source_url: {
    label: "Conservation source",
    read: (s, { linksAsText }) =>
      maybe(s.conservation_source_url, url => link(url, null, linksAsText)),
  },
  is_stub: { label: "Stub", read: s => scalar(yesNo(s.is_stub)) },
  notes_md: { label: "Notes", read: s => words(s.notes_md) },
  version_notes_md: {
    label: "Versions",
    read: s => words(s.version_notes_md),
  },
  licensing_status: {
    label: "Licensing",
    read: s => scalar(text(LICENSING_STATUS_LABELS[s.licensing_status])),
  },
  licensing_notes_md: {
    label: "Licensing notes",
    read: s => words(s.licensing_notes_md),
  },
  licence: {
    label: "Licence",
    read: s => maybe(s.licence, licence => text(LICENCE_LABELS[licence])),
  },
  licence_version: {
    label: "Licence version",
    read: s => maybe(s.licence_version, text),
  },
  historical_source_md: {
    label: "Historical source",
    read: s => words(s.historical_source_md),
  },
  period_start: {
    label: "Period from",
    read: s => maybe(s.period_start, year => text(String(year))),
  },
  period_end: {
    label: "Period to",
    read: s => maybe(s.period_end, year => text(String(year))),
  },
  aliases: {
    label: "Also known as",
    read: s =>
      list(
        s.aliases,
        alias => `${alias.text}\u0000${alias.kind}`,
        alias => [
          text(alias.text),
          text(standalone(PIECE_ALIAS_KIND_LABELS[alias.kind])),
        ]
      ),
  },
  terms: {
    label: "Categories",
    read: s =>
      list(
        s.terms,
        t => `${t.term.slug}\u0000${t.part ?? ""}`,
        t => [
          termRef(t.term),
          text(FACET_LABELS[t.term.facet]),
          t.part ? text(PIECE_PART_LABELS[t.part]) : null,
          t.is_primary ? text("Primary") : null,
        ]
      ),
  },
  credits: {
    label: "Credits",
    read: s =>
      list(
        s.credits,
        c =>
          [c.role, c.attribution, c.person?.slug ?? "", c.part ?? ""].join(
            "\u0000"
          ),
        c => [
          text(CREDIT_ROLE_LABELS[c.role]),
          // A credit names a person exactly when it is `named`.
          c.person
            ? personRef(c.person)
            : c.attribution === "named"
              ? null
              : text(ATTRIBUTION_LABELS[c.attribution]),
          c.part ? text(PIECE_PART_LABELS[c.part]) : null,
          c.certainty === "certain"
            ? null
            : text(standalone(CERTAINTY_QUALIFIERS[c.certainty])),
          c.note ? text(c.note) : null,
        ]
      ),
  },
  relations: {
    label: "Related pieces",
    read: s =>
      list(
        s.relations,
        r => `${r.type}\u0000${r.piece.slug}`,
        r => [text(PIECE_RELATION_LABELS[r.type].outgoing), pieceRef(r.piece)]
      ),
  },
  links: {
    label: "Links",
    read: (s, { linksAsText }) =>
      list(
        s.links,
        l => l.url,
        l => [
          link(l.url, l.title, linksAsText),
          ...linkDetails(l),
          l.performances.length > 0
            ? count(l.performances.length, "performance")
            : null,
        ]
      ),
  },
};

const PROFILE_FIELDS: Fields<Profile> = {
  pronouns: {
    label: "Pronouns",
    read: p => maybe(p.pronouns, value => text(value)),
  },
  notes_md: { label: "Notes", read: p => words(p.notes_md) },
  licensing_status: {
    label: "Licensing",
    read: p => scalar(text(LICENSING_STATUS_LABELS[p.licensing_status])),
  },
  licensing_notes_md: {
    label: "Licensing notes",
    read: p => words(p.licensing_notes_md),
  },
  aliases: {
    label: "Also known as",
    read: p =>
      list(
        p.aliases,
        alias => `${alias.name}\u0000${alias.kind}`,
        alias => [text(alias.name), text(PERSON_ALIAS_KIND_LABELS[alias.kind])]
      ),
  },
  roles: {
    label: "Roles",
    read: p =>
      list(
        p.roles,
        role => role,
        role => [text(PERSON_ROLE_LABELS[role])]
      ),
  },
  affiliations: {
    label: "Affiliations",
    read: p =>
      list(
        p.affiliations,
        term => term.slug,
        term => [termRef(term)]
      ),
  },
  relations: {
    label: "Relations",
    read: p =>
      list(
        p.relations,
        r => `${r.type}\u0000${r.person.slug}`,
        r => [
          text(PERSON_RELATION_LABELS[r.type].outgoing),
          personRef(r.person),
        ]
      ),
  },
  links: {
    label: "Links",
    // A link with performances is text only, whatever its pieces (B14);
    // the pieces themselves are linked inside the site.
    read: (p, { linksAsText }) =>
      list(
        p.links,
        l => l.url,
        l => [
          link(l.url, l.title, linksAsText || l.performances.length > 0),
          ...linkDetails(l),
          ...l.performances.map(performance =>
            performance.piece
              ? pieceRef(performance.piece)
              : text("A performance of no particular piece")
          ),
        ]
      ),
  },
};

/** The person fields other than `profile`, which is expanded below. */
const PERSON_FIELDS: Fields<Omit<Snapshots["person"], "profile">> = {
  name: { label: "Name", read: s => scalar(text(s.name)) },
  kind: {
    label: "Kind",
    read: s => scalar(text(PERSON_KIND_LABELS[s.kind])),
  },
  status: {
    label: "Status",
    read: s => scalar(text(PERSON_STATUS_LABELS[s.status])),
  },
  status_date: {
    label: "Status date",
    read: s => maybe(s.status_date, date => text(formatDate(date))),
  },
  status_source_url: {
    label: "Status source",
    read: (s, { linksAsText }) =>
      maybe(s.status_source_url, url => link(url, null, linksAsText)),
  },
  is_stub: { label: "Stub", read: s => scalar(yesNo(s.is_stub)) },
};

const TERM_FIELDS: Fields<Snapshots["term"]> = {
  facet: {
    label: "Facet",
    read: s => scalar(text(FACET_LABELS[s.facet])),
  },
  name: { label: "Full name", read: s => scalar(text(s.name)) },
  display_name: { label: "Name", read: s => scalar(text(s.display_name)) },
  parent: { label: "Part of", read: s => maybe(s.parent, termRef) },
  related_affiliation: {
    label: "Related affiliation",
    read: s => maybe(s.related_affiliation, termRef),
  },
  description_md: { label: "Description", read: s => words(s.description_md) },
  position: {
    label: "Position",
    read: s => scalar(text(String(s.position))),
  },
  aliases: {
    label: "Also called",
    read: s =>
      list(
        s.aliases,
        alias => alias,
        alias => [text(alias)]
      ),
  },
};

const COLLECTION_FIELDS: Fields<Snapshots["collection"]> = {
  name: { label: "Name", read: s => scalar(text(s.name)) },
  url: {
    label: "Where",
    read: (s, { linksAsText }) =>
      maybe(s.url, url => link(url, null, linksAsText)),
  },
  kind: {
    label: "Kind",
    read: s => scalar(text(COLLECTION_KIND_LABELS[s.kind])),
  },
  description_md: { label: "Description", read: s => words(s.description_md) },
  region: { label: "Region", read: s => maybe(s.region, termRef) },
  parent: {
    label: "Part of",
    read: s =>
      maybe(s.parent, parent => ({
        kind: "internal",
        to: `/collections/${parent.id}`,
        text: parent.name,
      })),
  },
  is_bardic_resource: {
    label: "Made for bards",
    read: s => scalar(yesNo(s.is_bardic_resource)),
  },
  enumerable: {
    label: "Contents can be listed",
    read: s => scalar(text(ENUMERABLE_LABELS[s.enumerable])),
  },
};

const EVENT_FIELDS: Fields<Snapshots["event"]> = {
  name: { label: "Name", read: s => scalar(text(s.name)) },
  kind: { label: "Kind", read: s => scalar(text(EVENT_KIND_LABELS[s.kind])) },
  description_md: { label: "Description", read: s => words(s.description_md) },
};

// ---------------------------------------------------------------------------
// Diffing two readings

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The diff of a field read from the base (null: none) and the snapshot. */
function diffReadings(before: Reading | null, after: Reading): FieldDiff {
  switch (after.kind) {
    case "scalar":
      return {
        kind: "scalar",
        before: before?.kind === "scalar" ? before.value : null,
        after: after.value,
      };
    case "text": {
      const was = before?.kind === "text" ? before.text : null;
      return {
        kind: "text",
        before: was,
        after: after.text,
        words:
          was === null || after.text === null
            ? null
            : wordDiff(was, after.text),
      };
    }
    case "list": {
      const old = new Map(
        (before?.kind === "list" ? before.items : []).map(item => [
          item.key,
          item,
        ])
      );
      const added: DiffItem[] = [];
      const changed: { before: DiffItem; after: DiffItem }[] = [];
      for (const item of after.items) {
        const was = old.get(item.key);
        if (!was) added.push(item);
        else if (!same(was.parts, item.parts))
          changed.push({ before: was, after: item });
        old.delete(item.key);
      }
      return { kind: "list", added, removed: [...old.values()], changed };
    }
  }
}

/** Whether a diff shows any change (a sub-field the base had the same). */
function differs(diff: FieldDiff): boolean {
  switch (diff.kind) {
    case "scalar":
    case "text":
      return !same(diff.before, diff.after);
    case "list":
      return diff.added.length + diff.removed.length + diff.changed.length > 0;
  }
}

/**
 * The changed fields in the order the field map lists them, which is the
 * page's order (the title first); a field the map doesn't list (a person's
 * `profile`) goes last.
 */
function inPageOrder<Field extends string>(
  fields: Readonly<Record<string, unknown>>,
  changed: readonly Field[]
): Field[] {
  const rank = (field: string) => {
    const place = Object.keys(fields).indexOf(field);
    return place === -1 ? Infinity : place;
  };
  return [...changed].sort((a, b) => rank(a) - rank(b));
}

function rowsOf<Snapshot>(
  fields: Fields<Snapshot>,
  changed: readonly (keyof Snapshot & string)[],
  snapshot: Snapshot,
  base: Snapshot | null,
  context: Context
): DiffRow[] {
  return inPageOrder(fields, changed).map(field => {
    const { label, read } = fields[field];
    return {
      field,
      label,
      diff: diffReadings(
        base ? read(base, context) : null,
        read(snapshot, context)
      ),
    };
  });
}

const IDENTITY_ONLY = "Identity only (the person prefers not to have a page)";

const EMPTY_PROFILE: Profile = {
  pronouns: null,
  notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  aliases: [],
  roles: [],
  affiliations: [],
  relations: [],
  links: [],
};

/**
 * The person `profile` row(s): one per sub-field that differs, each named
 * "Profile: {sub-field}"; a side with no profile is "Identity only" in a
 * "Profile" row first, and its sub-fields compare as empty.
 */
function profileRows(
  after: Profile | null,
  before: Profile | null | undefined,
  context: Context
): DiffRow[] {
  const first = before === undefined;
  const rows: DiffRow[] = [];
  if (after === null || before === null) {
    rows.push({
      field: "profile",
      label: "Profile",
      diff: {
        kind: "scalar",
        before: first
          ? null
          : [text(before === null ? IDENTITY_ONLY : "A full profile")],
        after: [text(after === null ? IDENTITY_ONLY : "A full profile")],
      },
    });
  }
  const keys = Object.keys(PROFILE_FIELDS) as (keyof Profile)[];
  for (const key of keys) {
    const { label, read } = PROFILE_FIELDS[key];
    const now = read(after ?? EMPTY_PROFILE, context);
    const was = read(before ?? EMPTY_PROFILE, context);
    // Only what differs (from an empty profile, for a first version).
    if (!differs(diffReadings(was, now))) continue;
    rows.push({
      field: `profile.${key}`,
      label: `Profile: ${label}`,
      diff: diffReadings(first ? null : was, now),
    });
  }
  return rows;
}

/** Whether a piece revision is restricted now or in either snapshot. */
function isRestrictedPiece(
  revision: Extract<Revision, { readonly entity_type: "piece" }>
): boolean {
  return [
    revision.entity.conservation_status,
    revision.snapshot.conservation_status,
    revision.base_snapshot?.conservation_status,
  ].includes("restricted");
}

/** The changes `revision` made, ready to render. */
export function revisionChanges(revision: Revision): RevisionChanges {
  const first = revision.base_snapshot === null;
  switch (revision.entity_type) {
    case "piece": {
      const context = { linksAsText: isRestrictedPiece(revision) };
      return {
        first,
        linksAsText: context.linksAsText,
        rows: rowsOf(
          PIECE_FIELDS,
          revision.changed_fields,
          revision.snapshot,
          revision.base_snapshot,
          context
        ),
      };
    }
    case "person": {
      const context = { linksAsText: false };
      const { snapshot, base_snapshot: base } = revision;
      return {
        first,
        linksAsText: false,
        rows: inPageOrder(PERSON_FIELDS, revision.changed_fields).flatMap(
          field =>
            field === "profile"
              ? profileRows(
                  snapshot.profile,
                  base === null ? undefined : base.profile,
                  context
                )
              : rowsOf(PERSON_FIELDS, [field], snapshot, base, context)
        ),
      };
    }
    case "term":
      return {
        first,
        linksAsText: false,
        rows: rowsOf(
          TERM_FIELDS,
          revision.changed_fields,
          revision.snapshot,
          revision.base_snapshot,
          { linksAsText: false }
        ),
      };
    case "collection":
      return {
        first,
        linksAsText: false,
        rows: rowsOf(
          COLLECTION_FIELDS,
          revision.changed_fields,
          revision.snapshot,
          revision.base_snapshot,
          { linksAsText: false }
        ),
      };
    case "event":
      return {
        first,
        linksAsText: false,
        rows: rowsOf(
          EVENT_FIELDS,
          revision.changed_fields,
          revision.snapshot,
          revision.base_snapshot,
          { linksAsText: false }
        ),
      };
  }
}
