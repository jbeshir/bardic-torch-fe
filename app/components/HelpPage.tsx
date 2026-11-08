import { Fragment } from "react";
import { Link } from "~/components/ui/Link";
import { HELP_HREF, LICENCE_URL, wikiPageUrl } from "~/constants/navigation";
import { MarkdownPart } from "~/content/markdown/components";
import type { HelpContent } from "~/content/help/pages";
import type { HelpFrontmatter } from "~/content/help/frontmatter";
import { WikiPage } from "./WikiPage";

/** "31 Oct 2026" (DESIGN §11.1). */
const REVIEWED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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
 * The licence and credit line at the foot of a help page (DESIGN §10.2):
 * CC BY-SA 4.0, and, for text adapted from the original wiki, which pages
 * it came from and that its contributors wrote them.
 */
function LicenceLine({
  frontmatter,
}: {
  readonly frontmatter: HelpFrontmatter;
}) {
  const { sourcePages, lastReviewed } = frontmatter;
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
          Adapted from <SourceList titles={sourcePages} /> on the original
          Bardic Torch wiki by its contributors.
        </>
      ) : null}{" "}
      Last reviewed{" "}
      <time dateTime={lastReviewed} className="whitespace-nowrap">
        {REVIEWED.format(new Date(`${lastReviewed}T00:00:00Z`))}
      </time>
      .
    </>
  );
}

/**
 * A help page in the wiki page template (DESIGN §10.2): breadcrumbs, the
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
                Adapted from the original wiki
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
