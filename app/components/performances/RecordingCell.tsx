import { UserLink } from "~/components/catalogue/UserLink";
import { linkName } from "~/components/links/LinkRow";
import { linkExposure, LINK_NOT_SHOWN } from "~/catalogue/restricted";
import type { PieceSummary } from "~/schemas/catalogue";

/**
 * The recording of a performance in an event's or a bard's list. A
 * restricted piece's recording is never linked off its own page (plan
 * §4.0): it says where to look instead, with no anchor and no address.
 * Otherwise it is the reader's link, named by its title or its host.
 */
export function RecordingCell({
  piece,
  link,
}: {
  readonly piece: PieceSummary | null;
  readonly link: { readonly url: string; readonly title: string | null };
}) {
  if (linkExposure(piece) === "internal-only") {
    return (
      <span className="text-caption text-fg-subtle">{LINK_NOT_SHOWN}</span>
    );
  }
  return (
    <UserLink url={link.url} appearance="plain">
      {linkName(link)}
    </UserLink>
  );
}
