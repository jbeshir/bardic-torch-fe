import { Link } from "~/components/ui/Link";
import { LICENCE_URL } from "~/constants/navigation";

/**
 * The licence meta line at the foot of every entity's Read page (plan
 * §4.0): the site's own text licence (not a piece's licence), what the
 * import left out of the pages it adapted from the original wiki (true of
 * every page, as the Read view does not say whether it was imported), and
 * the credit to the contributors the page history names. A page with no
 * history to show (a person who prefers not to have a page) ends the
 * sentence at what the import left out.
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
      licence. Pages imported from the original Bardic Torch wiki are adapted
      from it, leaving out lyrics, wiki formatting and template text
      {historyPath ? (
        <>
          ; this page’s contributors are credited in the{" "}
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
