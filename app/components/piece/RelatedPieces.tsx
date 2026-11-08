import { useId } from "react";
import { PieceListItem } from "~/components/catalogue/PieceListItem";
import { PIECE_RELATION_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";

type Relation = Piece["relations"][number];

/** One label's pieces, under its h3. */
function Group({
  label,
  relations,
}: {
  readonly label: string;
  readonly relations: readonly Relation[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{label}</h3>
      <ul role="list" className="not-prose">
        {relations.map(({ piece }) => (
          <PieceListItem key={piece.slug} piece={piece} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A piece's relations to other pieces (plan §4.5), grouped by how they
 * read from this piece: "Variant of" (outgoing), "Variants" (incoming) and
 * so on, a text in another form the same both ways. Groups keep the API's
 * order (outgoing first, each by type and title).
 */
export function RelatedPieces({
  relations,
}: {
  readonly relations: Piece["relations"];
}) {
  const groups = new Map<string, Relation[]>();
  for (const relation of relations) {
    const label = PIECE_RELATION_LABELS[relation.type][relation.direction];
    groups.set(label, [...(groups.get(label) ?? []), relation]);
  }
  return [...groups].map(([label, members]) => (
    <Group key={label} label={label} relations={members} />
  ));
}
