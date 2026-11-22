import { Fragment } from "react";
import { Link } from "~/components/ui/Link";
import { helpHref, wikiPageUrl } from "~/constants/navigation";

/** "‘A’", "‘A’ and ‘B’", "‘A’, ‘B’ and ‘C’", each a link to the wiki page. */
function SourceList({ titles }: { readonly titles: readonly string[] }) {
  return titles.map((title, index) => (
    <Fragment key={title}>
      {index === 0 ? "" : index === titles.length - 1 ? " and " : ", "}
      <Link to={wikiPageUrl(title)} appearance="inherit">
        {`‘${title}’`}
      </Link>
    </Fragment>
  ));
}

/**
 * The credit for text adapted from the original wiki, as CC BY-SA asks:
 * the pages it came from, their contributors, and that it was changed.
 * `partly` for a page that is mostly our own words.
 */
export function WikiCredit({
  sourcePages,
  partly,
}: {
  readonly sourcePages: readonly string[];
  readonly partly: boolean;
}) {
  return (
    <>
      {partly ? "Partly adapted" : "Adapted"} from{" "}
      <SourceList titles={sourcePages} /> on the original Bardic Torch wiki by
      its contributors, with changes; see{" "}
      <Link to={helpHref("licence")} appearance="inherit">
        Licence &amp; attribution
      </Link>
      .
    </>
  );
}
