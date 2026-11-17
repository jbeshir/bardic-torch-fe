import { IconLock } from "@tabler/icons-react";
import { Alert } from "~/components/ui/Alert";

type PageBannerProps =
  | {
      /** We know the piece or person exists but have little on it. */
      readonly kind: "stub";
      readonly subject: "piece" | "person";
    }
  | {
      /** The creator asks that the work isn't recorded or shared. */
      readonly kind: "restricted";
    }
  | {
      /** The person asked not to have a page; this stub records it. */
      readonly kind: "no-page";
      readonly name: string;
    };

/**
 * A page-level state under the tab row: the
 * info Banner for a stub, a restricted work (with the lock icon; it
 * replaces every "help preserve" prompt) or a person who prefers no page.
 */
export function PageBanner(props: PageBannerProps) {
  switch (props.kind) {
    case "stub":
      return (
        <Alert tone="info" banner title="This page is a stub.">
          We know this {props.subject} exists but haven’t gathered much yet.
        </Alert>
      );
    case "restricted":
      return (
        <Alert
          tone="info"
          banner
          icon={IconLock}
          title="The creator does not allow this work to be recorded, archived, or shared."
        />
      );
    case "no-page":
      return (
        <Alert
          tone="info"
          banner
          title={`${props.name} prefers not to have a page.`}
        >
          Their statement is cited in the notes below, so that everyone knows
          how to respect their wishes.
        </Alert>
      );
  }
}
