import { Link } from "~/components/ui/Link";
import { LICENCE_URL } from "~/constants/navigation";

/**
 * The licence meta line at the foot of every entity's Read page (plan
 * §4.0): the site's own text licence (not a piece's licence) and the
 * credit for text adapted from the original wiki, whose contributors the
 * page history names. A page with no history to show (a person who asked
 * not to have a page) ends the sentence at the wiki.
 */
export function LicenceLine({
  historyPath,
}: {
  /** The entity's History view: `/pieces/the-copper-kettle/history`. */
  readonly historyPath?: string;
}) {
  return (
    <>
      Text is available under the{" "}
      <Link to={LICENCE_URL} appearance="inherit">
        Creative Commons Attribution-ShareAlike 4.0
      </Link>{" "}
      licence. This page may be adapted from the original Bardic Torch wiki
      {historyPath ? (
        <>
          ; its contributors are credited in the{" "}
          <Link to={historyPath} appearance="inherit">
            page history
          </Link>
          .
        </>
      ) : (
        "."
      )}
    </>
  );
}
