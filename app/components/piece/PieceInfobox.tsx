import { LicensingSummary } from "~/components/catalogue/LicensingCard";
import { Infobox } from "~/components/ui/Infobox";
import {
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { creditRows } from "./Credits";
import { hasOrigin, OriginRow } from "./OriginRow";

/**
 * The other names a piece goes by, each with what kind of name it is.
 * Redirect aliases are search aids, never shown.
 */
function aliasesOf(piece: Piece) {
  return piece.aliases.flatMap(({ text, kind }) =>
    kind === "redirect" ? [] : [{ text, kind: PIECE_ALIAS_KIND_LABELS[kind] }]
  );
}

/**
 * The piece page's facts box, "About this piece" (plan §4.5): what it is
 * and its other names; its credits; its origin; its conservation status and
 * its licensing. A row with nothing recorded (no other names, no origin) is
 * left out, except the credits, whose absence is
 * itself shown.
 */
export function PieceInfobox({ piece }: { readonly piece: Piece }) {
  const aliases = aliasesOf(piece);
  return (
    <Infobox
      title="About this piece"
      sections={[
        {
          heading: "Details",
          rows: [
            { label: "Kind", value: PIECE_KIND_LABELS[piece.kind] },
            ...(aliases.length > 0
              ? [
                  {
                    label: "Also known as",
                    value: (
                      <ul role="list" className="grid gap-1">
                        {aliases.map(alias => (
                          <li key={`${alias.kind}:${alias.text}`}>
                            {alias.text}{" "}
                            <span className="text-fg-subtle">
                              ({alias.kind})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
          ],
        },
        { heading: "Credits", rows: creditRows(piece.credits) },
        {
          heading: "Origin",
          rows: hasOrigin(piece.terms)
            ? [{ label: "Origin", value: <OriginRow terms={piece.terms} /> }]
            : [],
        },
        {
          heading: "Conservation",
          rows: [
            {
              label: "Conservation",
              value: (
                <ConservationBadge
                  status={piece.conservation_status}
                  size="sm"
                  link
                />
              ),
            },
          ],
        },
        {
          heading: "Licensing",
          rows: [
            {
              label: "Licensing",
              value: <LicensingSummary status={piece.licensing_status} />,
            },
          ],
        },
      ]}
    />
  );
}
