import { UserLink } from "~/components/catalogue/UserLink";
import { personStatus } from "~/catalogue/person";
import { LicensingSummary } from "~/components/catalogue/LicensingCard";
import { linkName } from "~/components/links/LinkRow";
import { Infobox } from "~/components/ui/Infobox";
import { TagList } from "~/components/ui/TagList";
import {
  PERSON_ALIAS_KIND_LABELS,
  PERSON_ROLE_LABELS,
} from "~/constants/vocabulary";
import type { Person } from "~/schemas/catalogue";

type Profile = NonNullable<Person["profile"]>;

/** The other names a person goes by. */
function aliasesOf(profile: Profile) {
  return profile.aliases.map(({ name, kind }) => ({
    name,
    kind: PERSON_ALIAS_KIND_LABELS[kind],
  }));
}

/** A person's websites, promoted from their links into the infobox. */
function Websites({ profile }: { readonly profile: Profile }) {
  const websites = profile.links.filter(link => link.roles.includes("website"));
  return (
    <ul role="list" className="grid gap-1 wrap-anywhere">
      {websites.map(link => (
        <li key={link.url}>
          <UserLink url={link.url} appearance="standalone">
            {linkName(link)}
          </UserLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * A person's facts box (plan §4.6): their other names by kind, their roles
 * (in the API's order), their affiliations as chips, their website, their
 * licensing (linked to the card) and, unless they are active, their
 * status. Only public aliases arrive; a row with nothing is left out.
 */
export function PersonInfobox({ person }: { readonly person: Person }) {
  const { profile } = person;
  if (!profile) return null;
  const aliases = aliasesOf(profile);
  const status = personStatus(person);
  const hasWebsite = profile.links.some(link => link.roles.includes("website"));
  return (
    <Infobox
      title={person.kind === "group" ? "About this group" : "About this bard"}
      sections={[
        {
          heading: "Details",
          rows: [
            ...(aliases.length > 0
              ? [
                  {
                    label: "Also known as",
                    value: (
                      <ul role="list" className="grid gap-1">
                        {aliases.map(alias => (
                          <li key={`${alias.kind}:${alias.name}`}>
                            {alias.name}{" "}
                            <span className="text-fg-subtle">
                              ({alias.kind})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
            {
              label: "Roles",
              value:
                profile.roles.length > 0
                  ? profile.roles
                      .map(role => PERSON_ROLE_LABELS[role])
                      .join(", ")
                  : null,
            },
            ...(profile.affiliations.length > 0
              ? [
                  {
                    label: "Affiliations",
                    value: (
                      <TagList
                        size="sm"
                        tags={profile.affiliations.map(term => ({
                          label: term.display_name,
                          to: `/categories/${term.slug}`,
                        }))}
                      />
                    ),
                  },
                ]
              : []),
            ...(hasWebsite
              ? [{ label: "Website", value: <Websites profile={profile} /> }]
              : []),
            ...(status ? [{ label: "Status", value: status }] : []),
          ],
        },
        {
          heading: "Licensing",
          rows: [
            {
              label: "Licensing",
              value: <LicensingSummary status={profile.licensing_status} />,
            },
          ],
        },
      ]}
    />
  );
}
