import { IconAlertTriangle } from "@tabler/icons-react";
import { isUserUrl } from "~/catalogue/user-url";
import { Link } from "~/components/ui/Link";
import type { Piece } from "~/schemas/catalogue";

type CheckedLink = Pick<Piece["links"][number], "liveness" | "archived_url">;

/**
 * What the link checker found, under a link (plan §4.5): for a dead link a
 * warning, "This link may be broken", with the archived copy when there is
 * one (and `archive` allows it: never for a restricted piece); for a site
 * that refused the checker, a caption saying so. A link that works, or
 * that was never checked, needs no note.
 */
export function Liveness({
  link,
  archive,
}: {
  readonly link: CheckedLink;
  /** Whether an archived copy may be offered. */
  readonly archive: boolean;
}) {
  switch (link.liveness) {
    case "dead":
      return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-warning-fg">
          <span className="inline-flex items-center gap-1.5">
            <IconAlertTriangle
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-warning-icon"
            />
            This link may be broken
          </span>
          {archive && link.archived_url && isUserUrl(link.archived_url) ? (
            <Link to={link.archived_url} userContent compact>
              Archived copy
            </Link>
          ) : null}
        </p>
      );
    case "blocked":
      return (
        <p className="text-caption text-fg-subtle">
          This site wouldn’t let us check the link
        </p>
      );
    case "ok":
    case "unknown":
      return null;
  }
}
