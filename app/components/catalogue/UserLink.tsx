import type { ComponentProps, ReactNode } from "react";
import { Link } from "~/components/ui/Link";
import { isUserUrl } from "~/catalogue/user-url";

/**
 * A link a reader added (a citation's, a recording's): a `userContent`
 * Link (`nofollow ugc`, the external mark) to an http(s) address, or just
 * its text when the address is anything else, so no other scheme is ever
 * followed. `appearance` and `compact` are the Link's, for where the link
 * stands (a table cell, a list row, an infobox).
 */
export function UserLink({
  url,
  appearance = "prose",
  compact = false,
  children,
}: {
  readonly url: string;
  readonly appearance?: ComponentProps<typeof Link>["appearance"];
  readonly compact?: boolean;
  readonly children: ReactNode;
}) {
  return isUserUrl(url) ? (
    <Link to={url} userContent appearance={appearance} compact={compact}>
      {children}
    </Link>
  ) : (
    children
  );
}
