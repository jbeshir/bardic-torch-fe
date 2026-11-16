import { Fragment } from "react";
import { linkExposure } from "~/catalogue/restricted";
import { LicenceLine } from "~/components/catalogue/LicenceLine";
import {
  LICENSING_ID,
  LicensingCard,
} from "~/components/catalogue/LicensingCard";
import {
  pageSection,
  type PageSectionEntry,
} from "~/components/catalogue/PageSection";
import { EntityPage } from "~/components/EntityPage";
import { PageBanner } from "~/components/PageBanner";

import { UserMarkdown } from "~/components/UserMarkdown";
import { FACET_LABELS, PIECE_KIND_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";
import type { MarkdownTree } from "~/schemas/markdown";
import { Performances, performancesOf } from "./Performances";
import { PieceInfobox } from "./PieceInfobox";
import { WhereToFind } from "./WhereToFind";

/**
 * What the piece layout's loader gives its views (through the outlet): the
 * piece (a restricted one with only its licensing sources, as
 * `withoutRestrictedPieceLinks` leaves it), and its Markdown fields as the
 * sanitised trees the server made of them (null when empty).
 */
export type PieceView = {
  readonly piece: Piece;
  readonly markdown: {
    readonly notes: MarkdownTree | null;
    readonly versions: MarkdownTree | null;
    readonly licensingNotes: MarkdownTree | null;
  };
};

/**
 * The page's sections, in order (plan §4.5), each only when it has
 * something but the links' and the licensing card. A restricted piece
 * shows none of its links or performances, only a sentence saying why, and
 * its licensing sources in the licensing card (§4.0).
 */
function sectionsOf({ piece, markdown }: PieceView): PageSectionEntry[] {
  const prose = (id: string, label: string, tree: MarkdownTree | null) =>
    tree ? [pageSection(id, label, <UserMarkdown tree={tree} />)] : [];
  const restricted = linkExposure(piece) === "internal-only";
  return [
    ...prose("notes", "Notes", markdown.notes),
    restricted
      ? pageSection(
          "links",
          "Links",
          <p>
            The creator does not allow this work to be shared, so its links are
            not shown.
          </p>
        )
      : pageSection(
          "where-to-find-it",
          "Where to find it",
          <WhereToFind piece={piece} />
        ),
    ...(!restricted && performancesOf(piece.links).length > 0
      ? [
          pageSection(
            "performances",
            "Performances",
            <Performances links={piece.links} />
          ),
        ]
      : []),
    {
      id: LICENSING_ID,
      label: "Licensing",
      element: (
        <LicensingCard
          subject="piece"
          status={piece.licensing_status}
          notes={markdown.licensingNotes}
          // A source the licensing notes already quote isn't listed again.
          sources={piece.links.filter(
            link =>
              link.roles.includes("licensing_source") &&
              !piece.licensing_notes_md?.includes(link.url)
          )}
        />
      ),
    },
    ...prose("versions", "Versions", markdown.versions),
  ];
}

/**
 * The page-level state under the title rule (plan §4.5), if any: a
 * restricted piece's banner (which replaces every other prompt, the stub's
 * included), or the stub's.
 */
function banner(piece: Piece) {
  if (piece.conservation_status === "restricted") {
    return <PageBanner kind="restricted" />;
  }
  return piece.is_stub ? <PageBanner kind="stub" subject="piece" /> : undefined;
}

/**
 * A piece's head, the same on its Read and History views: "Pieces" in the
 * breadcrumbs, the title, the kind as the meta line, and the
 * restricted or stub banner.
 */
export function pieceHead(piece: Piece) {
  return {
    path: `/pieces/${piece.slug}`,
    title: piece.title,
    breadcrumbs: {
      trail: [{ label: "Pieces", to: "/pieces" }] as const,
      current: piece.title,
    },
    subtitle: PIECE_KIND_LABELS[piece.kind],
    banners: banner(piece),
  };
}

/**
 * A piece's Read view (plan §4.5): its head (`pieceHead`), the infobox,
 * every term as a category chip ("Mood: Singalong") and the licence line
 * pointing at the page history.
 */
export function PiecePage({ view }: { readonly view: PieceView }) {
  const { piece } = view;
  const head = pieceHead(piece);
  const sections = sectionsOf(view);
  return (
    <EntityPage
      {...head}
      infobox={<PieceInfobox piece={piece} />}
      categories={piece.terms.map(term => ({
        label: term.display_name,
        prefix: `${FACET_LABELS[term.facet]}:`,
        to: `/categories/${term.slug}`,
      }))}
      licence={<LicenceLine historyPath={`${head.path}/history`} />}
      contents={sections.map(({ id, label }) => ({ id, label }))}
    >
      {sections.map(({ id, element }) => (
        <Fragment key={id}>{element}</Fragment>
      ))}
    </EntityPage>
  );
}
