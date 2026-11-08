import { Card, CardList } from "~/components/ui/Card";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { TryAgain } from "~/components/ui/ErrorState";
import { Infobox } from "~/components/ui/Infobox";
import { Link } from "~/components/ui/Link";
import { TagList } from "~/components/ui/TagList";
import { wikiPageUrl } from "~/constants/navigation";
import { CONSERVATION_STATUSES } from "~/constants/vocabulary";
import { Example, Specimen } from "./Specimen";

const FACTS = [
  {
    heading: "Statuses",
    rows: [
      { label: "Low risk", value: "Four or more places" },
      { label: "Endangered", value: "Exactly three places" },
      { label: "Restricted", value: null },
    ],
  },
  {
    heading: "Read more",
    rows: [
      {
        label: "Guide",
        value: <Link to="/help/conservation-status">Conservation status</Link>,
      },
      {
        label: "Moods",
        value: (
          <TagList
            size="sm"
            tags={[
              { label: "Singalong", to: wikiPageUrl("Category:Singalong") },
              { label: "Tragic", to: wikiPageUrl("Category:Tragic") },
            ]}
          />
        ),
      },
    ],
  },
] as const;

export function Infoboxes() {
  return (
    <Specimen
      id="infobox"
      title="Infobox"
      summary="The facts box at the side of a page (DESIGN §6.10). It floats right from md; here each one is shown on its own."
    >
      <Example label="Facts, with an empty value and a footer action">
        <div className="w-full md:w-infobox xl:w-infobox-xl">
          <Infobox
            title="At a glance"
            subtitle="How the catalogue grades pieces"
            sections={FACTS}
            footer={
              <Link to="/help/contributing">Help complete this page</Link>
            }
          />
        </div>
      </Example>
      <Example label="Loading (client transitions only)">
        <div className="w-full md:w-infobox xl:w-infobox-xl">
          <Infobox title="At a glance" sections={FACTS} loading />
        </div>
      </Example>
      <Example label="Failed to load">
        <div className="w-full md:w-infobox xl:w-infobox-xl">
          <Infobox
            title="At a glance"
            sections={FACTS}
            error={{ retry: <TryAgain size="sm" /> }}
          />
        </div>
      </Example>
    </Specimen>
  );
}

export function Cards() {
  return (
    <Specimen
      id="card"
      title="Card"
      summary="A box with a heading (DESIGN §6.11): static, or a whole-card link. Lists of cards are lists."
    >
      <Example label="Static and link cards in a list" wide>
        <div className="w-full">
          <CardList>
            <Card title="Links, never lyrics" eyebrow="Why">
              We point to where a piece lives, so the bard keeps control of
              their words.
            </Card>
            <Card
              title="How to contribute"
              to="/help/contributing"
              meta="5 minute read"
            >
              Add a piece, fix a link, or tell us what a bard prefers.
            </Card>
            <Card title="Licence and attribution" to="/help/licence">
              What you can reuse, and how to credit it.
            </Card>
          </CardList>
        </div>
      </Example>
    </Specimen>
  );
}

/** Fifteen topics, to show the overflow disclosure. */
const MANY_TAGS = [
  "Battle",
  "Drinking",
  "Dragons",
  "Fireside",
  "Harvest",
  "Heraldry",
  "Lament",
  "Love",
  "Midwinter",
  "Mourning",
  "Sea",
  "Swords",
  "Travel",
  "Victory",
  "Wassail",
].map(label => ({
  label,
  to: `/styleguide?topic=${label.toLowerCase()}`,
}));

export function Tags() {
  return (
    <Specimen
      id="tag-list"
      title="Chip and TagList"
      summary="Category and facet chips (DESIGN §6.12). In FE1 they point at the original wiki."
    >
      <Example label="Categories (to the original wiki)" wide>
        <TagList
          tags={[
            { label: "Singalong", to: wikiPageUrl("Category:Singalong") },
            { label: "Drinking", to: wikiPageUrl("Category:Drinking") },
            { label: "Tragic", to: wikiPageUrl("Category:Tragic") },
          ]}
        />
      </Example>
      <Example label="Facet prefix, current chip" wide>
        <TagList
          tags={[
            {
              label: "Singalong",
              prefix: "Mood:",
              to: "/styleguide?mood=singalong",
            },
            {
              label: "Fireside",
              prefix: "Setting:",
              to: "/styleguide",
              current: true,
            },
          ]}
        />
      </Example>
      <Example label="More than 12: “Show all 15” (all shown without JS)" wide>
        <TagList tags={MANY_TAGS} />
      </Example>
      <Example label="Small size">
        <TagList
          size="sm"
          tags={[{ label: "Comic", to: "/styleguide?mood=comic" }]}
        />
      </Example>
      <Example label="No categories">
        <TagList tags={[]} />
      </Example>
    </Specimen>
  );
}

export function ConservationBadges() {
  return (
    <Specimen
      id="conservation-badge"
      title="ConservationBadge"
      summary="A piece’s conservation status (DESIGN §6.13, §2.5): icon, label and border, never colour alone. As a link it goes to the status’s entry on the help page."
    >
      {(["md", "sm"] as const).map(size => (
        <Example key={`static-${size}`} label={`Static, ${size}`}>
          {CONSERVATION_STATUSES.map(status => (
            <ConservationBadge key={status} status={status} size={size} />
          ))}
        </Example>
      ))}
      {(["md", "sm"] as const).map(size => (
        <Example key={`link-${size}`} label={`Link to the help entry, ${size}`}>
          {CONSERVATION_STATUSES.map(status => (
            <ConservationBadge key={status} status={status} size={size} link />
          ))}
        </Example>
      ))}
      <Example label="In a row that already says “Conservation”">
        <ConservationBadge status="endangered" named />
      </Example>
    </Specimen>
  );
}
