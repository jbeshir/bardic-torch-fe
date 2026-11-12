import { Fragment } from "react";
import { pieceSubtitle, restrictionStatement } from "~/catalogue/piece";
import { linkExposure } from "~/catalogue/restricted";
import { isUserUrl } from "~/catalogue/user-url";
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
import { FACET_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";
import type { MarkdownTree } from "~/schemas/markdown";
import { Performances, performancesOf } from "./Performances";
import { PieceInfobox } from "./PieceInfobox";
import { RelatedPieces } from "./RelatedPieces";
import { RestrictedLinks, WhereToFind } from "./WhereToFind";

/**
 * What the piece layout's loader gives its views (through the outlet): the
 * piece, and its Markdown fields as the sanitised trees the server made of
 * them (null when empty).
 */
export type PieceView = {
  readonly piece: Piece;
  readonly markdown: {
    readonly notes: MarkdownTree | null;
    readonly versions: MarkdownTree | null;
    readonly historicalSource: MarkdownTree | null;
    readonly licensingNotes: MarkdownTree | null;
  };
  /** The reader has an edit of the piece waiting for review. */
  readonly pending?: boolean;
};

/**
 * The page's sections, in order (plan §4.5), each only when it has
 * something but the links' and the licensing card. A restricted piece's
 * links (its performances and licensing sources included) are one closed
 * disclosure under "Where it has been recorded" (§4.0).
 */
function sectionsOf({ piece, markdown }: PieceView): PageSectionEntry[] {
  const prose = (id: string, label: string, tree: MarkdownTree | null) =>
    tree ? [pageSection(id, label, <UserMarkdown tree={tree} />)] : [];
  const restricted = linkExposure(piece) === "internal-only";
  return [
    ...prose("notes", "Notes", markdown.notes),
    restricted
      ? pageSection(
          "where-it-has-been-recorded",
          "Where it has been recorded",
          <RestrictedLinks piece={piece} />
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
          licence={piece.licence}
          notes={markdown.licensingNotes}
          sources={piece.links.filter(link =>
            link.roles.includes("licensing_source")
          )}
          sourcesHidden={restricted}
        />
      ),
    },
    ...prose("versions", "Versions", markdown.versions),
    ...prose(
      "historical-source",
      "Historical source",
      markdown.historicalSource
    ),
    ...(piece.relations.length > 0
      ? [
          pageSection(
            "related-pieces",
            "Related pieces",
            <RelatedPieces relations={piece.relations} />
          ),
        ]
      : []),
  ];
}

/**
 * A piece's infobox and sections without its head: the editor's preview
 * of the piece (a whole page there would repeat the h1 and the tabs).
 */
export function PieceBody({ view }: { readonly view: PieceView }) {
  return (
    <div className="flow-root">
      <PieceInfobox piece={view.piece} />
      <div className="prose-bt">
        {sectionsOf(view).map(({ id, element }) => (
          <Fragment key={id}>{element}</Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * The page-level state under the title rule (plan §4.5), if any: a
 * restricted piece's banner (which replaces every other prompt, the stub's
 * included), or the stub's.
 */
function banner(piece: Piece) {
  if (piece.conservation_status === "restricted") {
    const statement = restrictionStatement(piece.conservation_history);
    return (
      <PageBanner
        kind="restricted"
        statementUrl={statement && isUserUrl(statement) ? statement : undefined}
      />
    );
  }
  return piece.is_stub ? <PageBanner kind="stub" subject="piece" /> : undefined;
}

/**
 * A piece's head, the same on its Read and History views: "Pieces" in the
 * breadcrumbs, the title, the kinds and period as the meta line, and the
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
    subtitle: pieceSubtitle(piece),
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
      pending={view.pending}
      infobox={<PieceInfobox piece={piece} />}
      categories={piece.terms.map(({ term }) => ({
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
