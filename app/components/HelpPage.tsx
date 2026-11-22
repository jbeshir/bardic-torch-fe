import { formatDate } from "~/catalogue/format";
import { Link } from "~/components/ui/Link";
import { HELP_HREF, LICENCE_URL, wikiPageUrl } from "~/constants/navigation";
import { MarkdownPart } from "~/content/markdown/components";
import type { HelpContent } from "~/content/help/pages";
import type { HelpFrontmatter } from "~/content/help/frontmatter";
import { WikiCredit } from "./WikiCredit";
import { WikiPage } from "./WikiPage";

/**
 * The licence and credit line at the foot of a help page:
 * CC BY-SA 4.0, and, for text adapted from the original wiki, which pages
 * it came from, that its contributors wrote them and that it was changed.
 */
function LicenceLine({
  frontmatter,
}: {
  readonly frontmatter: HelpFrontmatter;
}) {
  const { sourcePages, partlyAdapted, lastReviewed } = frontmatter;
  return (
    <>
      This page is available under{" "}
      <Link to={LICENCE_URL} appearance="inherit">
        CC BY-SA 4.0
      </Link>
      .
      {sourcePages.length > 0 ? (
        <>
          {" "}
          <WikiCredit sourcePages={sourcePages} partly={partlyAdapted} />
        </>
      ) : null}{" "}
      Last reviewed{" "}
      <time dateTime={lastReviewed} className="whitespace-nowrap">
        {formatDate(lastReviewed)}
      </time>
      .
    </>
  );
}

/**
 * A help page in the wiki page template: breadcrumbs, the
 * source link on the title rule, the infobox, the intro, the contents from
 * four h2s, the prose and the licence line. The index (/help) has no
 * breadcrumbs or source, and its summary is its intro.
 */
export function HelpPage({ content }: { readonly content: HelpContent }) {
  const { slug, page, frontmatter, contents } = content;
  const [source] = frontmatter.sourcePages;
  const isIndex = slug === null;
  return (
    <WikiPage
      title={frontmatter.title}
      {...(isIndex
        ? {}
        : {
            breadcrumbs: {
              trail: [{ label: "Help", to: HELP_HREF }],
              current: frontmatter.title,
            },
            categories: [{ label: "Help", to: HELP_HREF }],
          })}
      {...(source
        ? {
            meta: (
              <Link to={wikiPageUrl(source)} appearance="muted">
                {`${frontmatter.partlyAdapted ? "Partly adapted" : "Adapted"} from the original wiki`}
              </Link>
            ),
          }
        : {})}
      infobox={<MarkdownPart page={page} slot="infobox" />}
      intro={
        isIndex ? (
          <p>{frontmatter.summary}</p>
        ) : (
          <MarkdownPart page={page} slot="intro" />
        )
      }
      contents={contents}
      licence={<LicenceLine frontmatter={frontmatter} />}
    >
      <MarkdownPart page={page} slot="body" />
    </WikiPage>
  );
}
