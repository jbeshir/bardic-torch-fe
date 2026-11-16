import { Link } from "~/components/ui/Link";
import { LICENCE_URL } from "~/constants/navigation";

/**
 * The licence meta line at the foot of every entity's Read page (plan
 * §4.0): the site's own text licence (not a piece's licence), what the
 * import left out of the pages it adapted from the original wiki (true of
 * every page, as the Read view does not say whether it was imported).
 */
export function LicenceLine() {
  return (
    <>
      Text is available under the{" "}
      <Link to={LICENCE_URL} appearance="inherit">
        Creative Commons Attribution-ShareAlike 4.0
      </Link>{" "}
      licence. Pages imported from the original Bardic Torch wiki are adapted
      from it, leaving out lyrics, wiki formatting and template text
      {"."}
    </>
  );
}
