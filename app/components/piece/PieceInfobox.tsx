import { formatPeriod } from "~/catalogue/piece";
import { LicensingSummary } from "~/components/catalogue/LicensingCard";
import { Infobox } from "~/components/ui/Infobox";
import {
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";
import { ConservationRow } from "./ConservationRow";
import { creditRows } from "./Credits";
import { hasOrigin, OriginRow } from "./OriginRow";

/** "Song", or "Song" and, under it, "also: Dance music, Instrumental". */
function KindValue({ piece }: { readonly piece: Piece }) {
  return (
    <>
      {PIECE_KIND_LABELS[piece.kind]}
      {piece.secondary_kinds.length > 0 ? (
        <span className="block text-caption text-fg-subtle">
          also:{" "}
          {piece.secondary_kinds
            .map(kind => PIECE_KIND_LABELS[kind])
            .join(", ")}
        </span>
      ) : null}
    </>
  );
}

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
 * The piece page's facts box, "About this piece" (plan §4.5): what it is,
 * when it dates from and its other names; its credits; its origin; its
 * conservation status and its licensing. A row with nothing recorded (no period, no other
 * names, no origin) is left out, except the credits, whose absence is
 * itself shown.
 */
export function PieceInfobox({ piece }: { readonly piece: Piece }) {
  const period = formatPeriod(piece.period_start, piece.period_end);
  const aliases = aliasesOf(piece);
  return (
    <Infobox
      title="About this piece"
      sections={[
        {
          heading: "Details",
          rows: [
            { label: "Kind", value: <KindValue piece={piece} /> },
            ...(period ? [{ label: "Period", value: period }] : []),
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
              value: <ConservationRow piece={piece} />,
            },
          ],
        },
        {
          heading: "Licensing",
          rows: [
            {
              label: "Licensing",
              value: (
                <LicensingSummary
                  status={piece.licensing_status}
                  licence={piece.licence}
                />
              ),
            },
          ],
        },
      ]}
    />
  );
}
