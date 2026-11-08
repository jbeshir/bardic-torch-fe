import { IconAlertTriangle } from "@tabler/icons-react";
import { Link } from "~/components/ui/Link";
import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  CREDIT_ROLE_LABELS,
  PIECE_PART_LABELS,
} from "~/constants/vocabulary";
import type { Certainty, Piece } from "~/schemas/catalogue";

type Credit = Piece["credits"][number];

/**
 * How sure the credit is, after the name: "probably", "possibly", or
 * "disputed" with the warning triangle (the word says it, never the icon
 * alone). A certain credit has none.
 */
export function CertaintyQualifier({
  certainty,
}: {
  readonly certainty: Certainty;
}) {
  if (certainty === "certain") return null;
  return (
    <span className="text-fg-muted">
      {" "}
      {certainty === "disputed" ? (
        <IconAlertTriangle
          size={14}
          stroke={1.75}
          aria-hidden="true"
          className="mr-0.5 inline-block align-baseline"
        />
      ) : null}
      ({CERTAINTY_QUALIFIERS[certainty]})
    </span>
  );
}

/** Who a credit is to: the person's page, or "Traditional" and the like. */
function Credited({ credit }: { readonly credit: Credit }) {
  if (credit.person) {
    return (
      <Link to={`/bards/${credit.person.slug}`}>{credit.person.name}</Link>
    );
  }
  // The schema holds a credit without a person to an unnamed attribution.
  return credit.attribution === "named"
    ? null
    : ATTRIBUTION_LABELS[credit.attribution];
}

/**
 * A credit's row label: its role, with the part it is for, "Words (verses)"; just
 * the role when the part is the same word.
 */
export function creditLabel(credit: Pick<Credit, "role" | "part">): string {
  const role = CREDIT_ROLE_LABELS[credit.role];
  const part = credit.part ? PIECE_PART_LABELS[credit.part] : null;
  // "Tune (tune)" says it twice.
  return part && part !== role ? `${role} (${part.toLowerCase()})` : role;
}

/**
 * A piece's credits as infobox rows (plan §4.5), in the API's order: the
 * role as the label; the person (a link to their page) or the attribution,
 * the certainty qualifier and the note as the value. Credits to persons who
 * asked not to have a page never arrive, so the rows are what there is,
 * never padded: with none, one "Credits" row shows the empty value (never
 * "unknown author").
 */
export function creditRows(credits: Piece["credits"]) {
  if (credits.length === 0) return [{ label: "Credits", value: null }];
  return credits.map(credit => ({
    // Two credits differ in their role, part or who they are to.
    id: [
      credit.role,
      credit.part,
      credit.person?.slug ?? credit.attribution,
    ].join(":"),
    label: creditLabel(credit),
    value: (
      <>
        <Credited credit={credit} />
        <CertaintyQualifier certainty={credit.certainty} />
        {credit.note ? (
          <span className="block text-caption text-fg-subtle">
            {credit.note}
          </span>
        ) : null}
      </>
    ),
  }));
}
