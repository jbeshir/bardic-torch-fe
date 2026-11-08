import type { ReactNode } from "react";
import { Link } from "~/components/ui/Link";
import { isUserUrl } from "~/catalogue/user-url";

/**
 * A link a reader added (a citation's, a recording's): a `userContent`
 * Link (`nofollow ugc`, the external mark) to an http(s) address, or just
 * its text when the address is anything else, so no other scheme is ever
 * followed.
 */
export function UserLink({
  url,
  children,
}: {
  readonly url: string;
  readonly children: ReactNode;
}) {
  return isUserUrl(url) ? (
    <Link to={url} userContent appearance="prose">
      {children}
    </Link>
  ) : (
    <span>{children}</span>
  );
}
