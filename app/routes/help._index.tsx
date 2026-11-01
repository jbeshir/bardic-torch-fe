import type { MetaFunction } from "@remix-run/cloudflare";
import { HelpPage, helpMeta } from "~/components/HelpPage";
import { HELP_INDEX } from "~/content/help/pages";

export const meta: MetaFunction = () => helpMeta(HELP_INDEX.frontmatter);

/** The help index (DESIGN §10.2): a card for each help page. */
export default function HelpIndexRoute() {
  return <HelpPage content={HELP_INDEX} />;
}
