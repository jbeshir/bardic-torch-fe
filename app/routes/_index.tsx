import type { MetaFunction } from "@remix-run/cloudflare";
import { useId, type ReactNode } from "react";
import { LogoMark } from "~/components/LogoMark";
import { SearchBox } from "~/components/SearchBox";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { Card, CardList } from "~/components/ui/Card";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { CONTRIBUTE_HREF, FACETS, wikiPageUrl } from "~/constants/navigation";

export const meta: MetaFunction = () => [
  { title: "Bardic Torch" },
  {
    name: "description",
    content:
      "A community index of SCA bardic songs, stories and poems and the bards who made them, so they can be found, sung and passed on.",
  },
];

/** A home page section: an h2 with a rule under it, then its content. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-12">
      <h2
        id={titleId}
        className="mb-4 border-b border-border pb-2 text-h2 text-fg"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The home page (DESIGN §10.1), its copy adapted from the original wiki's
 * Main Page: what Bardic Torch is (an index, not an archive; links only;
 * keeping works alive; anyone can contribute), how to contribute here,
 * and, until the catalogue opens, the way to the original wiki.
 */
export default function Index() {
  return (
    <>
      <div className="rounded-xl bg-hero p-6 md:p-10">
        <LogoMark className="h-12 w-12 text-fg" />
        <h1 className="mt-4 max-w-prose text-display text-fg">
          Find the songs, stories and poems of the bardic community.
        </h1>
        <p className="mt-4 max-w-prose text-body-lg text-fg-muted">
          Bardic Torch helps bards find where a piece’s words, music, history,
          context and etiquette live, and helps audiences find that song they
          loved around the campfire but forgot the title of. We gather the
          bardic community’s scattered songbooks, playlists and album pages into
          one index, so works can be found, sung and passed on.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink to={CONTRIBUTE_HREF} variant="primary" size="lg">
            How to contribute
          </ButtonLink>
          <ButtonLink
            to={wikiPageUrl("Category:Pieces")}
            variant="secondary"
            size="lg"
            external="wiki"
          >
            Browse on the original wiki
          </ButtonLink>
        </div>
        <p className="mt-4 max-w-prose text-body-sm text-fg-muted">
          The catalogue is moving here soon. Until it opens, you can browse
          every piece and bard on the original Bardic Torch wiki.
        </p>
        <div className="mt-6 max-w-form">
          <SearchBox size="lg" />
        </div>
      </div>

      <Section title="Why Bardic Torch">
        <CardList>
          <Card title="An index, not an archive">
            Bardic works are spread across many songbooks, playlists and album
            pages. We don’t replace them. We link to them and make them findable
            by mood, topic, culture, origin and more. We never host lyrics,
            recordings or video: every piece points to where it already lives,
            and to its creator’s wishes about sharing.
          </Card>
          <Card title="Every version, everywhere">
            <p>
              We link to each version of the words and each performance,
              wherever it lives online or in print. Some works exist in only one
              or two places. When you find an endangered piece, add a link or
              host a copy, and help pass the torch.
            </p>
            <p className="mt-3">
              <Link to="/help/conservation-status">
                How conservation statuses work
              </Link>
            </p>
          </Card>
          <Card title="Anyone can contribute">
            <p>
              You don’t have to be a bard, and no contribution is too small. Log
              in, add what you know, and a moderator will review it before it
              goes live. That way the index can keep growing beyond what any one
              person could maintain.
            </p>
            <p className="mt-3">
              <Link to={CONTRIBUTE_HREF}>How to contribute</Link>
            </p>
          </Card>
        </CardList>
      </Section>

      <Section title="Start exploring on the original wiki">
        <TagList
          tags={FACETS.map(({ label, href }) => ({ label, to: href }))}
        />
      </Section>

      <Section title="For bards">
        <p className="max-w-prose text-body text-fg">
          Your wishes matter here. We want to show people who wrote a piece, how
          it’s licensed, whether to ask before performing it, and how you feel
          about sing-alongs, recordings and adaptations. Publish your
          preferences on your own site and we’ll link to them, so everyone can
          find them. You’re welcome to help with your own page, or to ask not to
          have one.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink to="/help/faq-for-bards" variant="secondary">
            FAQ for bards
          </ButtonLink>
          <ButtonLink to="/help/bard-preference-checklist" variant="secondary">
            Bard preference checklist
          </ButtonLink>
        </div>
        <div className="mt-8">
          <Alert tone="info">
            Bardic Torch is community-maintained and not affiliated with the
            Society for Creative Anachronism or any other organisation.
          </Alert>
        </div>
      </Section>

      <p className="mt-10 text-caption text-fg-subtle">
        The name has two meanings: a torch to search by, and passing the torch
        so works are kept for the next generation.
      </p>
    </>
  );
}
