import { IconLock } from "@tabler/icons-react";
import { Alert } from "~/components/ui/Alert";
import { Link } from "~/components/ui/Link";

/** A statement's address, from the API: a reader's URL. */
type StatementUrl = `http${string}`;

type PageBannerProps =
  | {
      /** The reader has an edit of the page at `path` waiting for review. */
      readonly kind: "pending";
      readonly path: string;
    }
  | {
      /** We know the piece or person exists but have little on it. */
      readonly kind: "stub";
      readonly subject: "piece" | "person";
    }
  | {
      /** The creator asks that the work isn't recorded or shared. */
      readonly kind: "restricted";
      readonly statementUrl?: StatementUrl | undefined;
    }
  | {
      /** The person asked not to have a page; this stub records it. */
      readonly kind: "no-page";
      readonly name: string;
      readonly statementUrl?: StatementUrl | undefined;
    };

/** The link to where they said so, when the API has one. */
function statement(url: StatementUrl | undefined) {
  return url ? (
    <Link to={url} userContent appearance="inherit">
      Read their statement
    </Link>
  ) : undefined;
}

/**
 * A page-level state under the tab row: the
 * info Banner for a stub, a restricted work (with the lock icon; it
 * replaces every "help preserve" prompt) or a person who prefers no page.
 * The statement link is the creator's own words, so it is shown when the
 * API has one; it is a reader's URL, so it is `nofollow ugc`. Editing is
 * FE3, so the stub's action is the contributing guide.
 */
export function PageBanner(props: PageBannerProps) {
  switch (props.kind) {
    case "pending":
      return (
        <Alert
          tone="pending"
          banner
          title="You have an edit of this page waiting for review."
          actions={
            <>
              <Link to={`${props.path}/edit`} appearance="inherit">
                Continue editing
              </Link>
              <Link to="/contributions" appearance="inherit">
                My contributions
              </Link>
            </>
          }
        >
          It will show here once a moderator has approved it.
        </Alert>
      );
    case "stub":
      return (
        <Alert
          tone="info"
          banner
          title="This page is a stub."
          actions={
            <Link to="/help/contributing" appearance="inherit">
              How to contribute
            </Link>
          }
        >
          We know this {props.subject} exists but haven’t gathered much yet.
        </Alert>
      );
    case "restricted":
      return (
        <Alert
          tone="info"
          banner
          icon={IconLock}
          title="The creator has asked that this work isn’t recorded or shared."
          actions={statement(props.statementUrl)}
        >
          Please respect their wishes.
        </Alert>
      );
    case "no-page":
      return (
        <Alert
          tone="info"
          banner
          title={`${props.name} has asked not to have a page here.`}
          actions={statement(props.statementUrl)}
        >
          This stub keeps their request on record so the page isn’t recreated.
        </Alert>
      );
  }
}
