import type { MetaFunction } from "react-router";
import { pageMeta } from "~/catalogue/seo";
import { HelpPage } from "~/components/HelpPage";
import { HELP_HREF } from "~/constants/navigation";
import { HELP_INDEX } from "~/content/help/pages";

export const meta: MetaFunction = args =>
  pageMeta(args, {
    title: HELP_INDEX.frontmatter.title,
    description: HELP_INDEX.frontmatter.description,
    preview: HELP_INDEX.frontmatter.summary,
    path: HELP_HREF,
  });

/** The help index: a card for each help page. */
export default function HelpIndexRoute() {
  return <HelpPage content={HELP_INDEX} />;
}
