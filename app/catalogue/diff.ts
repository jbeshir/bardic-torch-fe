import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  COLLECTION_KIND_LABELS,
  CONSERVATION_LABELS,
  CREDIT_ROLE_LABELS,
  FACET_LABELS,
  LICENSING_STATUS_LABELS,
  LINK_PLACE_TYPE_LABELS,
  LINK_ROLE_LABELS,
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_STATUS_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { Revision } from "~/schemas/catalogue";
import { isUserUrl } from "./user-url";

/**
 * The changes a revision made (plan §4.11), as plain text for the page to
 * show: one row per changed field, in the page's order (the API's
 * `changed_fields` are alphabetical), each labelled from the entity's field
 * map. A field is a string (null for none: a scalar or Markdown text, shown
 * whole before and after) or a list of keyed items, diffed as the items
 * added, removed and changed (the same key, other text).
 *
 * A person's `profile` is one field to the API; here it is a row per
 * sub-field that differs ("Profile: Roles"), with "Identity only" for a
 * side that has none.
 *
 * Links follow §4.0: in a restricted piece's revision (restricted now or in
 * either snapshot) every link is its title or host, never an address; so is
 * a person's link that carries performances (spec issue B14: we can't tell
 * whether those pieces were restricted).
 *
 * With no base (`base_snapshot: null`), a row's values are the new ones only.
 */

/** A list item: its key (never shown: a link's is its address) and its text. */
type Item = { readonly key: string; readonly text: string };

type Value = string | null | readonly Item[];

export type DiffRow = { readonly field: string; readonly label: string } & (
  | {
      readonly kind: "value";
      readonly before: string | null;
      readonly after: string | null;
    }
  | {
      readonly kind: "list";
      readonly added: readonly string[];
      readonly removed: readonly string[];
      readonly changed: readonly {
        readonly before: string;
        readonly after: string;
      }[];
    }
);

export type RevisionChanges = {
  /** No approved base: the rows are the values this revision set. */
  readonly first: boolean;
  /** Links are shown as text only (§4.0). */
  readonly linksAsText: boolean;
  readonly rows: readonly DiffRow[];
};

type Field<Snapshot> = {
  readonly label: string;
  /** What the snapshot holds; `asText` is whether links hide their address. */
  readonly value: (snapshot: Snapshot, asText: boolean) => Value;
};

type Fields<Snapshot> = { readonly [K in keyof Snapshot]: Field<Snapshot> };

/** The parts that are set, " · " between them. */
const join = (...parts: readonly (string | null | false)[]) =>
  parts.filter(Boolean).join(" · ");

/**
 * A label the page uses inside a sentence ("community archive", "probably"),
 * as a value of its own in sentence case.
 */
const standalone = (label: string) =>
  `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const maybe = <T>(value: T | null, show: (value: T) => string) =>
  value === null ? null : show(value);

/** A list's items; an item's key is its text unless it has its own. */
const items = <T>(
  values: readonly T[],
  text: (value: T) => string,
  key: (value: T) => string = text
): readonly Item[] =>
  values.map(value => ({ key: key(value), text: text(value) }));

/** The host of `url` ("video.example"), or the URL itself if it has none. */
function urlHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * A link: its title and address, or (links as text, or any scheme but
 * http(s)) its title or host, never the address.
 */
function link(url: string, title: string | null, asText: boolean): string {
  if (asText || !isUserUrl(url)) return title ?? urlHost(url);
  return title ? `${title} (${url})` : url;
}

/** What a link holds besides its address: roles, place, locator, collection. */
const linkDetails = (value: {
  readonly roles: readonly (keyof typeof LINK_ROLE_LABELS)[];
  readonly place_type: keyof typeof LINK_PLACE_TYPE_LABELS | null;
  readonly locator: string | null;
  readonly collection: { readonly name: string } | null;
  readonly platform: string | null;
  readonly description: string | null;
}) =>
  join(
    value.roles.map(role => LINK_ROLE_LABELS[role]).join(", "),
    value.place_type && standalone(LINK_PLACE_TYPE_LABELS[value.place_type]),
    value.platform,
    value.collection?.name ?? null,
    value.locator,
    value.description
  );

// ---------------------------------------------------------------------------
// The fields of each entity type, in the page's order

type Snapshots = {
  readonly [E in Revision["entity_type"]]: Extract<
    Revision,
    { readonly entity_type: E }
  >["snapshot"];
};

type Profile = NonNullable<Snapshots["person"]["profile"]>;

const PIECE_FIELDS: Fields<Snapshots["piece"]> = {
  title: { label: "Title", value: s => s.title },
  kind: { label: "Kind", value: s => PIECE_KIND_LABELS[s.kind] },
  conservation_status: {
    label: "Conservation status",
    value: s => CONSERVATION_LABELS[s.conservation_status],
  },
  is_stub: { label: "Stub", value: s => yesNo(s.is_stub) },
  notes_md: { label: "Notes", value: s => s.notes_md },
  version_notes_md: { label: "Versions", value: s => s.version_notes_md },
  licensing_status: {
    label: "Licensing",
    value: s => LICENSING_STATUS_LABELS[s.licensing_status],
  },
  licensing_notes_md: {
    label: "Licensing notes",
    value: s => s.licensing_notes_md,
  },
  aliases: {
    label: "Also known as",
    value: s =>
      items(s.aliases, alias =>
        join(alias.text, standalone(PIECE_ALIAS_KIND_LABELS[alias.kind]))
      ),
  },
  terms: {
    label: "Categories",
    value: s =>
      items(
        s.terms,
        t => join(t.display_name, FACET_LABELS[t.facet]),
        t => t.slug
      ),
  },
  credits: {
    label: "Credits",
    value: s =>
      items(
        s.credits,
        c =>
          join(
            CREDIT_ROLE_LABELS[c.role],
            // A credit names a person exactly when it is `named`.
            c.person
              ? c.person.name
              : c.attribution !== "named" && ATTRIBUTION_LABELS[c.attribution],
            c.certainty !== "certain" &&
              standalone(CERTAINTY_QUALIFIERS[c.certainty])
          ),
        c =>
          [c.role, c.attribution, c.person?.slug ?? c.person?.name ?? ""].join(
            "\u0000"
          )
      ),
  },
  links: {
    label: "Links",
    value: (s, asText) =>
      items(
        s.links,
        l =>
          join(
            link(l.url, l.title, asText),
            linkDetails(l),
            l.performances.length > 0 &&
              `${l.performances.length} performance${l.performances.length === 1 ? "" : "s"}`
          ),
        l => l.url
      ),
  },
};

const PROFILE_FIELDS: Fields<Profile> = {
  notes_md: { label: "Notes", value: p => p.notes_md },
  licensing_status: {
    label: "Licensing",
    value: p => LICENSING_STATUS_LABELS[p.licensing_status],
  },
  licensing_notes_md: {
    label: "Licensing notes",
    value: p => p.licensing_notes_md,
  },
  aliases: {
    label: "Also known as",
    value: p =>
      items(p.aliases, alias =>
        join(alias.name, PERSON_ALIAS_KIND_LABELS[alias.kind])
      ),
  },
  roles: {
    label: "Roles",
    value: p => items(p.roles, role => PERSON_ROLE_LABELS[role]),
  },
  affiliations: {
    label: "Affiliations",
    value: p => items(p.affiliations, term => term.display_name),
  },
  links: {
    label: "Links",
    // A link with performances is text only, whatever its pieces (B14).
    value: (p, asText) =>
      items(
        p.links,
        l =>
          join(
            link(l.url, l.title, asText || l.performances.length > 0),
            linkDetails(l),
            ...l.performances.map(
              performance =>
                performance.piece?.title ??
                "A performance of no particular piece"
            )
          ),
        l => l.url
      ),
  },
};

/** The person fields other than `profile`, which is expanded below. */
const PERSON_FIELDS: Fields<Omit<Snapshots["person"], "profile">> = {
  name: { label: "Name", value: s => s.name },
  kind: { label: "Kind", value: s => PERSON_KIND_LABELS[s.kind] },
  status: { label: "Status", value: s => PERSON_STATUS_LABELS[s.status] },
  is_stub: { label: "Stub", value: s => yesNo(s.is_stub) },
};

const TERM_FIELDS: Fields<Snapshots["term"]> = {
  facet: { label: "Facet", value: s => FACET_LABELS[s.facet] },
  name: { label: "Full name", value: s => s.name },
  display_name: { label: "Name", value: s => s.display_name },
  parent: { label: "Part of", value: s => s.parent?.display_name ?? null },
  related_affiliation: {
    label: "Related affiliation",
    value: s => s.related_affiliation?.display_name ?? null,
  },
  description_md: { label: "Description", value: s => s.description_md },
  position: { label: "Position", value: s => String(s.position) },
};

const COLLECTION_FIELDS: Fields<Snapshots["collection"]> = {
  name: { label: "Name", value: s => s.name },
  url: {
    label: "Where",
    value: (s, asText) => maybe(s.url, url => link(url, null, asText)),
  },
  kind: { label: "Kind", value: s => COLLECTION_KIND_LABELS[s.kind] },
  description_md: { label: "Description", value: s => s.description_md },
  region: { label: "Region", value: s => s.region?.display_name ?? null },
};

const EVENT_FIELDS: Fields<Snapshots["event"]> = {
  name: { label: "Name", value: s => s.name },
};

// ---------------------------------------------------------------------------
// Diffing

function rowOf(
  field: string,
  label: string,
  before: Value,
  after: Value
): DiffRow {
  if (typeof after === "string" || after === null) {
    return {
      field,
      label,
      kind: "value",
      before: typeof before === "string" ? before : null,
      after,
    };
  }
  const old = new Map(
    (typeof before === "object" && before !== null ? before : []).map(item => [
      item.key,
      item,
    ])
  );
  const added: string[] = [];
  const changed: { before: string; after: string }[] = [];
  for (const item of after) {
    const was = old.get(item.key);
    if (!was) added.push(item.text);
    else if (was.text !== item.text)
      changed.push({ before: was.text, after: item.text });
    old.delete(item.key);
  }
  return {
    field,
    label,
    kind: "list",
    added,
    removed: [...old.values()].map(item => item.text),
    changed,
  };
}

/**
 * The rows of the `changed` fields, in the order the field map lists them
 * (the page's). `profile` marks the sub-fields of a person's profile.
 */
function rowsOf<Snapshot>(
  fields: Fields<Snapshot>,
  changed: readonly string[],
  after: Snapshot,
  before: Snapshot | null,
  asText: boolean,
  profile = false
): DiffRow[] {
  return (Object.keys(fields) as (keyof Snapshot & string)[])
    .filter(field => changed.includes(field))
    .map(field => {
      const { label, value } = fields[field];
      return rowOf(
        profile ? `profile.${field}` : field,
        profile ? `Profile: ${label}` : label,
        before && value(before, asText),
        value(after, asText)
      );
    });
}

const IDENTITY_ONLY = "Identity only (the person prefers not to have a page)";

const EMPTY_PROFILE: Profile = {
  notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  aliases: [],
  roles: [],
  affiliations: [],
  links: [],
};

/**
 * The person `profile` rows: a "Profile" row first for a side with no
 * profile, then one per sub-field that differs (an empty profile standing
 * in for a side with none, or for no base).
 */
function profileRows(
  after: Profile | null,
  before: Profile | null,
  first: boolean
): DiffRow[] {
  const side = (profile: Profile | null) =>
    profile ? "A full profile" : IDENTITY_ONLY;
  const sides =
    after === null || before === null
      ? [rowOf("profile", "Profile", first ? null : side(before), side(after))]
      : [];
  const subs = rowsOf(
    PROFILE_FIELDS,
    Object.keys(PROFILE_FIELDS),
    after ?? EMPTY_PROFILE,
    before ?? EMPTY_PROFILE,
    false,
    true
  ).filter(row =>
    row.kind === "value"
      ? row.before !== row.after
      : row.added.length + row.removed.length + row.changed.length > 0
  );
  return [...sides, ...subs];
}

/**
 * What the diff reads of a revision: its snapshots in the shape of its
 * `entity_type`, the fields that differ, and the entity as it is now
 * (null for a new entity's revision that isn't approved).
 */
export type DiffInput = Revision extends infer R
  ? R extends Revision
    ? Pick<
        R,
        "entity_type" | "snapshot" | "base_snapshot" | "changed_fields"
      > & {
        readonly entity: R["entity"] | null;
      }
    : never
  : never;

/** Whether a piece revision is restricted now or in either snapshot. */
function isRestrictedPiece(
  revision: Extract<DiffInput, { readonly entity_type: "piece" }>
): boolean {
  return [
    revision.entity?.conservation_status,
    revision.snapshot.conservation_status,
    revision.base_snapshot?.conservation_status,
  ].includes("restricted");
}

/** The changes `revision` made, ready to show. */
export function revisionChanges(revision: DiffInput): RevisionChanges {
  const first = revision.base_snapshot === null;
  const rowsIn = <Snapshot>(
    fields: Fields<Snapshot>,
    r: {
      readonly snapshot: Snapshot;
      readonly base_snapshot: Snapshot | null;
      readonly changed_fields: readonly string[];
    },
    asText = false
  ) => rowsOf(fields, r.changed_fields, r.snapshot, r.base_snapshot, asText);
  switch (revision.entity_type) {
    case "piece": {
      const linksAsText = isRestrictedPiece(revision);
      return {
        first,
        linksAsText,
        rows: rowsIn(PIECE_FIELDS, revision, linksAsText),
      };
    }
    case "person": {
      const { snapshot, base_snapshot: base } = revision;
      const profile = revision.changed_fields.includes("profile")
        ? profileRows(snapshot.profile, base?.profile ?? null, first)
        : [];
      return {
        first,
        linksAsText: false,
        rows: [...rowsIn(PERSON_FIELDS, revision), ...profile],
      };
    }
    case "term":
      return { first, linksAsText: false, rows: rowsIn(TERM_FIELDS, revision) };
    case "collection":
      return {
        first,
        linksAsText: false,
        rows: rowsIn(COLLECTION_FIELDS, revision),
      };
    case "event":
      return {
        first,
        linksAsText: false,
        rows: rowsIn(EVENT_FIELDS, revision),
      };
  }
}
