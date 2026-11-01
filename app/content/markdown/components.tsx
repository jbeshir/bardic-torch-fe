import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { Alert } from "~/components/ui/Alert";
import { Card, CardList } from "~/components/ui/Card";
import {
  Infobox,
  InfoboxFact,
  InfoboxFactLabel,
  InfoboxFacts,
  InfoboxFactValue,
} from "~/components/ui/Infobox";
import { Link } from "~/components/ui/Link";
import type { HelpContent } from "~/content/help/pages";

type Children = { children?: ReactNode };

/** A Markdown link: internal paths through Remix, absolute URLs marked as external. */
function contentLink(appearance: "prose" | "standalone") {
  return function ContentLink({
    href,
    children,
  }: Children & { href?: string | undefined }) {
    if (!href) {
      throw new Error("A link in a help page has no address");
    }
    return (
      <Link to={href} appearance={appearance}>
        {children}
      </Link>
    );
  };
}

/** An alert in the prose, with the prose's rhythm around it. */
function contentAlert(tone: "info" | "warning") {
  return function ContentAlert({ children }: Children) {
    return (
      <div className="my-6">
        <Alert tone={tone}>{children}</Alert>
      </div>
    );
  };
}

/**
 * The component map (DESIGN §10.2): what each element of a compiled help
 * page renders as. The directives (remark-directives.ts) become Alerts, the
 * Infobox and Cards; links become Links. Infobox links are standalone
 * links, as in any infobox (§6.10); prose links are prose links.
 */
const COMPONENTS = {
  a: contentLink("prose"),
  note: contentAlert("info"),
  warning: contentAlert("warning"),
  cardlist: ({ children }: Children) => (
    <div className="my-6">
      <CardList columns={2}>{children}</CardList>
    </div>
  ),
  card: ({ title, to, children }: Children & { title: string; to: string }) => (
    <Card title={title} to={to}>
      {children}
    </Card>
  ),
  infobox: ({ title, children }: Children & { title: string }) => (
    <Infobox title={title}>{children}</Infobox>
  ),
  infoboxfacts: InfoboxFacts,
  infoboxfact: InfoboxFact,
  infoboxlabel: InfoboxFactLabel,
  infoboxvalue: InfoboxFactValue,
} satisfies MDXComponents;

/** The parts rehype-help-page.ts splits a page into. */
type MarkdownSlot = "infobox" | "intro" | "body";

function slotComponents(slot: MarkdownSlot): MDXComponents {
  return {
    ...COMPONENTS,
    ...(slot === "infobox" ? { a: contentLink("standalone") } : {}),
    pageslot: ({ name, children }: Children & { name: string }) =>
      name === slot ? <>{children}</> : null,
  };
}

const SLOT_COMPONENTS: Readonly<Record<MarkdownSlot, MDXComponents>> = {
  infobox: slotComponents("infobox"),
  intro: slotComponents("intro"),
  body: slotComponents("body"),
};

/** One part of a compiled help page, rendered with the component map. */
export function MarkdownPart({
  page: Page,
  slot,
}: {
  page: HelpContent["page"];
  slot: MarkdownSlot;
}) {
  return <Page components={SLOT_COMPONENTS[slot]} />;
}
