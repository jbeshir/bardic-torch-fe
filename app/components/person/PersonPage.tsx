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
 * A person's head, the same on their Read and History views: "Bards" in
 * the breadcrumbs, the name, their kind, pronouns and status as the meta
 * line, and the banner: the one that keeps a no-page person's request on
 * record (with their statement when there is one), or the stub's.
 */
export function personHead(person: Person) {
  const statement = person.status_source_url;
  return {
    path: `/bards/${person.slug}`,
    title: person.name,
    breadcrumbs: {
      trail: [{ label: "Bards", to: "/bards" }] as const,
      current: person.name,
    },
    subtitle: personSubtitle(person),
    banners: !person.profile ? (
      <PageBanner
        kind="no-page"
        name={person.name}
        statementUrl={statement && isUserUrl(statement) ? statement : undefined}
      />
    ) : person.is_stub ? (
      <PageBanner kind="stub" subject="person" />
    ) : undefined,
  };
}

/**
 * A person's Read view (plan §4.6): their head (`personHead`). A person
 * who asked not to have a page is their identity only: no History tab
 * (plan R8; a direct `/bards/{slug}/history` still works) and no prose.
 * Anyone else has the infobox, their sections and the licence line
 * pointing at the page history.
 */
export function PersonPage({ view }: { readonly view: PersonView }) {
  const { person, markdown } = view;
  const head = personHead(person);
  const { profile } = person;
  if (!profile) {
    return (
      <EntityPage {...head} history={false} licence={<LicenceLine />}>
        {null}
      </EntityPage>
    );
  }
  const sections = sectionsOf(profile, markdown);
  return (
    <EntityPage
      {...head}
      infobox={<PersonInfobox person={person} />}
      contents={sections.map(({ id, label }) => ({ id, label }))}
      licence={<LicenceLine historyPath={`${head.path}/history`} />}
    >
      {sections.map(({ id, element }) => (
        <Fragment key={id}>{element}</Fragment>
      ))}
    </EntityPage>
  );
}
