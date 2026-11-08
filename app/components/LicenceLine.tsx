import { Link } from "~/components/ui/Link";
import { LICENCE_URL } from "~/constants/navigation";

/**
 * The licence meta line at the foot of an entity's Read page (plan §4.0,
 * DESIGN §5.4): the site's own text licence (PLAN §2 decision 13, not a
 * piece's), and the attribution of text
 * adapted from the original wiki, whose contributors the entity's page
 * history credits.
 */
export function LicenceLine({
  historyPath,
}: {
  /** The entity's History view: `/categories/swords/history`. */
  readonly historyPath: string;
}) {
  return (
    <>
      Text is available under the{" "}
      <Link to={LICENCE_URL} appearance="prose">
        Creative Commons Attribution-ShareAlike 4.0
      </Link>{" "}
      licence. This page may be adapted from the original Bardic Torch wiki; its
      contributors are credited in the{" "}
      <Link to={historyPath} appearance="prose">
        page history
      </Link>
      .
    </>
  );
}
