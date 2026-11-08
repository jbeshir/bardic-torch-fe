import { Disclosure } from "~/components/catalogue/Disclosure";
import { LinkGroups } from "~/components/links/LinkGroups";
import { EmptyState } from "~/components/ui/EmptyState";
import type { Piece } from "~/schemas/catalogue";
import { Performances, performancesOf } from "./Performances";

/**
 * Where a piece can be found (plan §4.5): its links grouped by role, but for
 * the performance role when the page lists the performances. A
 * piece with none says so; a stub with none asks for the first (the stub's
 * banner already points at the contributing guide; adding a link is FE3).
 */
export function WhereToFind({ piece }: { readonly piece: Piece }) {
  // The "Performances" section lists the performances' recordings, so the
  // performance role's own group would only repeat it right above.
  const links =
    performancesOf(piece.links).length > 0
      ? piece.links
          .map(link => ({
            ...link,
            roles: link.roles.filter(role => role !== "performance"),
          }))
          .filter(link => link.roles.length > 0)
      : piece.links;
  if (links.length > 0) return <LinkGroups links={links} />;
  if (piece.links.length > 0) {
    return <p>Its recorded performances are listed below.</p>;
  }
  return piece.is_stub ? (
    <EmptyState title="No links yet">
      Know where this piece lives online or in print? Add the first link.
    </EmptyState>
  ) : (
    <p>No links yet.</p>
  );
}

/**
 * A restricted piece's links, its performances and its licensing sources
 * (plan §4.0), all inside one closed disclosure whose body first says why:
 * no archived copies, and no prompt to add or record anything.
 */
export function RestrictedLinks({ piece }: { readonly piece: Piece }) {
  if (piece.links.length === 0) return <p>No links yet.</p>;
  return (
    <Disclosure summary="Show links (the creator asks that this isn’t shared further)">
      <p>
        The creator has asked that this work isn’t recorded or shared. These
        links are listed for reference only; please don’t repost them.
      </p>
      <LinkGroups links={piece.links} archive={false} />
      {performancesOf(piece.links).length > 0 ? (
        <>
          <h3>Recorded performances</h3>
          <Performances links={piece.links} />
        </>
      ) : null}
    </Disclosure>
  );
}
