import { useId, type ReactNode } from "react";
import {
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { formatCatalogueSize, formatNumber } from "~/catalogue/format";
import { NO_PIECE_FILTERS, pieceQuery } from "~/catalogue/query-state";
import { pageMeta } from "~/catalogue/seo";
import { LogoMark } from "~/components/LogoMark";
import { SearchBox } from "~/components/SearchBox";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { Card, CardList } from "~/components/ui/Card";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { SectionError } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { CONTRIBUTE_HREF, helpHref } from "~/constants/navigation";
import {
  BROWSE_STATUS_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { PieceKind } from "~/schemas/catalogue";
import { listPersons, listPieces, listTerms } from "~/server/catalogue.server";

export const meta: MetaFunction = args =>
  pageMeta(args, {
    description:
      "A community index of SCA bardic songs, stories and poems and the bards who made them, so they can be found, sung and passed on.",
    path: "/",
  });

/** The statuses the "Every version" card shows, with a link to each. */
const CARD_STATUSES = [
  "endangered",
  "critically_endangered",
  "low_risk",
] as const;

/** How many moods, and how many topics, the explore chips show. */
const TOP_TERMS = 3;

type Chip = { readonly label: string; readonly to: string };

type HomeData = {
  /** The catalogue's size, or null when either count couldn't be read. */
  readonly totals: {
    readonly pieces: number;
    readonly people: number;
  } | null;
  /** The kinds with their piece counts; null when the pieces failed. */
  readonly kinds:
    | readonly {
        readonly kind: PieceKind;
        readonly count: number;
      }[]
    | null;
  /** The most-used moods, then topics; null when the terms failed. */
  readonly topTerms: readonly Chip[] | null;
};

/**
 * The home page reads three things (plan §4.1), each its own region: the
 * piece count and kinds, the person count, and the terms for the top moods
 * and topics. A failure never fails the page (it is the front door): the
 * region says so, with "Try again".
 */
export async function loader({
  context,
}: LoaderFunctionArgs): Promise<HomeData> {
  const [pieces, persons, terms] = await Promise.all([
    listPieces(context, { limit: 1 }),
    listPersons(context, { limit: 1 }),
    listTerms(context, {}),
  ]);
  const top = (facet: "mood" | "topic") =>
    terms.ok
      ? terms.data.data
          .filter(term => term.facet === facet)
          .sort(
            (a, b) =>
              b.piece_count - a.piece_count ||
              a.display_name.localeCompare(b.display_name, "en-GB")
          )
          .slice(0, TOP_TERMS)
          .map(term => ({
            label: `${facet === "mood" ? "Mood" : "Topic"}: ${term.display_name}`,
            to: `/categories/${term.slug}`,
          }))
      : [];
  return {
    totals:
      pieces.ok && persons.ok
        ? { pieces: pieces.data.total, people: persons.data.total }
        : null,
    kinds: pieces.ok ? pieces.data.facets.kinds : null,
    topTerms: terms.ok ? [...top("mood"), ...top("topic")] : null,
  };
}

/** A home page section: an h2 with a rule under it, then its content. */
function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
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
 * keeping works alive; anyone can contribute), the ways into the
 * catalogue and how to contribute.
 */
export default function Index() {
  const { totals, kinds, topTerms } = useLoaderData<typeof loader>();
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
          <ButtonLink to="/pieces" variant="primary" size="lg">
            Browse pieces
          </ButtonLink>
          <ButtonLink to={CONTRIBUTE_HREF} variant="secondary" size="lg">
            How to contribute
          </ButtonLink>
        </div>
        <div className="mt-6 max-w-form">
          <SearchBox size="lg" label="Search the catalogue" />
        </div>
        {totals ? (
          <p className="mt-3 text-body-sm text-fg-muted">
            {formatCatalogueSize(totals.pieces, totals.people)}
          </p>
        ) : null}
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
              <Link to={helpHref("conservation-status")}>
                How conservation statuses work
              </Link>
            </p>
            <ul role="list" className="mt-3 grid gap-2">
              {CARD_STATUSES.map(status => (
                <li
                  key={status}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <ConservationBadge status={status} size="sm" named />
                  <Link
                    to={pieceQuery.href(NO_PIECE_FILTERS, { status: [status] })}
                    compact
                  >
                    {BROWSE_STATUS_LABELS[status]}
                  </Link>
                </li>
              ))}
            </ul>
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

      <Section title="Start exploring">
        {totals && topTerms ? null : (
          <div className="mb-4">
            <SectionError
              title={
                totals
                  ? "We couldn’t load the categories"
                  : "We couldn’t load the catalogue’s counts"
              }
            >
              The links below still work.
            </SectionError>
          </div>
        )}
        <TagList
          tags={[
            ...(kinds ?? []).map(({ kind, count }) => ({
              label: `${PIECE_KIND_LABELS[kind]} (${formatNumber(count)})`,
              to: pieceQuery.href(NO_PIECE_FILTERS, { kind: [kind] }),
            })),
            ...(topTerms ?? []),
          ]}
        />
        <ul role="list" className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link to="/categories">All categories</Link>
          </li>
          <li>
            <Link to="/collections">Collections</Link>
          </li>
          <li>
            <Link to="/events">Events and venues</Link>
          </li>
        </ul>
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
          <ButtonLink to={helpHref("faq-for-bards")} variant="secondary">
            FAQ for bards
          </ButtonLink>
          <ButtonLink
            to={helpHref("bard-preference-checklist")}
            variant="secondary"
          >
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
