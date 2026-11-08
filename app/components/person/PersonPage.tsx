import { Fragment } from "react";
import { personSubtitle } from "~/catalogue/person";
import { isUserUrl } from "~/catalogue/user-url";
import { LicenceLine } from "~/components/catalogue/LicenceLine";
import {
  LICENSING_ID,
  LicensingCard,
} from "~/components/catalogue/LicensingCard";
import {
  pageSection,
  type PageSectionEntry,
} from "~/components/catalogue/PageSection";
import { EntityPage } from "~/components/EntityPage";
import { LinkGroups } from "~/components/links/LinkGroups";
import { PageBanner } from "~/components/PageBanner";

import { UserMarkdown } from "~/components/UserMarkdown";
import type { Person } from "~/schemas/catalogue";
import type { MarkdownTree } from "~/schemas/markdown";
import { PersonInfobox } from "./PersonInfobox";
import { PersonPerformances } from "./PersonPerformances";
import { Relations } from "./Relations";
import { Works } from "./Works";

type Profile = NonNullable<Person["profile"]>;

/**
 * What the bard layout's loader gives its views (through the outlet): the
 * person, and their Markdown fields as the server's trees (null when
 * empty, and always for a person with no page).
 */
export type PersonView = {
  readonly person: Person;
  readonly markdown: {
    readonly notes: MarkdownTree | null;
    readonly licensingNotes: MarkdownTree | null;
  };
};

/**
 * A person's sections, in order (plan §4.6), each only when it has
 * something but the licensing card.
 */
function sectionsOf(
  profile: Profile,
  markdown: PersonView["markdown"]
): PageSectionEntry[] {
  return [
    ...(markdown.notes
      ? [pageSection("about", "About", <UserMarkdown tree={markdown.notes} />)]
      : []),
    {
      id: LICENSING_ID,
      label: "Licensing",
      element: (
        <LicensingCard
          subject="person"
          status={profile.licensing_status}
          notes={markdown.licensingNotes}
          sources={profile.links.filter(link =>
            link.roles.includes("licensing_source")
          )}
        />
      ),
    },
    ...(profile.works.length > 0
      ? [pageSection("works", "Works", <Works profile={profile} />)]
      : []),
    ...(profile.performances.length > 0
      ? [
          pageSection(
            "performances",
            "Performances",
            <PersonPerformances profile={profile} />
          ),
        ]
      : []),
    ...(profile.relations.length > 0
      ? [
          pageSection(
            "relations",
            "Relations",
            <Relations relations={profile.relations} />
          ),
        ]
      : []),
    ...(profile.links.length > 0
      ? [
          pageSection(
            "links",
            "Links",
            <LinkGroups links={profile.links} first={["external_profile"]} />
          ),
        ]
      : []),
  ];
}

/**
 * A person's Read view (plan §4.6): the entity page with "Bards" in the
 * breadcrumbs and their kind, pronouns and status as the meta line. A
 * person who asked not to have a page is their identity only: the name,
 * the kind, the banner that keeps their request on record (with their
 * statement when there is one), no History tab and no prose. Anyone else
 * has the stub banner when their page is one, the infobox, their sections
 * and the licence line pointing at the page history.
 */
export function PersonPage({ view }: { readonly view: PersonView }) {
  const { person, markdown } = view;
  const path = `/bards/${person.slug}`;
  const page = {
    path,
    title: person.name,
    breadcrumbs: {
      trail: [{ label: "Bards", to: "/bards" }] as const,
      current: person.name,
    },
    subtitle: personSubtitle(person),
  };
  const { profile } = person;
  if (!profile) {
    const statement = person.status_source_url;
    return (
      <EntityPage
        {...page}
        history={false}
        banners={
          <PageBanner
            kind="no-page"
            name={person.name}
            statementUrl={
              statement && isUserUrl(statement) ? statement : undefined
            }
          />
        }
        licence={<LicenceLine />}
      >
        {null}
      </EntityPage>
    );
  }
  const sections = sectionsOf(profile, markdown);
  return (
    <EntityPage
      {...page}
      banners={
        person.is_stub ? <PageBanner kind="stub" subject="person" /> : undefined
      }
      infobox={<PersonInfobox person={person} />}
      contents={sections.map(({ id, label }) => ({ id, label }))}
      licence={<LicenceLine historyPath={`${path}/history`} />}
    >
      {sections.map(({ id, element }) => (
        <Fragment key={id}>{element}</Fragment>
      ))}
    </EntityPage>
  );
}
