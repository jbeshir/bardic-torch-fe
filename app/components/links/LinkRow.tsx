import { formatDate } from "~/catalogue/format";
import { isUserUrl } from "~/catalogue/user-url";
import { Link } from "~/components/ui/Link";
import { LINK_PLACE_TYPE_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";
import { Liveness } from "./Liveness";

/** A piece's or a person's link: the fields both have. */
export type AnyLink = Omit<Piece["links"][number], "performances">;

/** A link's name: its title, or its address's host. */
export function linkName(link: Pick<AnyLink, "title" | "url">): string {
  return (
    link.title ?? (URL.canParse(link.url) ? new URL(link.url).host : link.url)
  );
}

/**
 * One link (plan §4.5): its title (or the address's host) as an external
 * link, a reader's URL (nofollow ugc); then a caption with the platform,
 * what kind of place it is and, for a link that works, when it was last
 * checked; the collection it is in, as an internal link with its locator;
 * the description; and what the link checker found (`Liveness`).
 * `archive: false` offers no archived copy (a restricted piece).
 */
export function LinkRow({
  link,
  archive = true,
}: {
  readonly link: AnyLink;
  readonly archive?: boolean;
}) {
  const name = linkName(link);
  const caption = [
    link.platform,
    link.place_type ? LINK_PLACE_TYPE_LABELS[link.place_type] : null,
    link.liveness === "ok" && link.last_checked_at
      ? `Checked ${formatDate(link.last_checked_at)}`
      : null,
  ].filter(part => part !== null);
  return (
    <li className="grid gap-1 border-b border-border py-3 wrap-anywhere last:border-b-0">
      <span className="text-body">
        {isUserUrl(link.url) ? (
          <Link to={link.url} userContent compact>
            {name}
          </Link>
        ) : (
          name
        )}
      </span>
      {caption.length > 0 ? (
        <span className="text-caption text-fg-subtle">
          {caption.join(" · ")}
        </span>
      ) : null}
      {link.collection ? (
        <span className="text-body-sm text-fg-muted">
          In{" "}
          <Link to={`/collections/${link.collection.id}`} appearance="plain">
            {link.collection.name}
          </Link>
          {link.locator ? ` (${link.locator})` : null}
        </span>
      ) : null}
      {link.description ? (
        <p className="text-body-sm text-fg-muted">{link.description}</p>
      ) : null}
      <Liveness link={link} archive={archive} />
    </li>
  );
}
