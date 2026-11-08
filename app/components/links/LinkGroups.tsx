import { useId } from "react";
import { LINK_ROLE_HEADINGS } from "~/constants/vocabulary";
import { linkRoleSchema, type LinkRole } from "~/schemas/catalogue";
import { LinkRow, type AnyLink } from "./LinkRow";

/** One role's heading and its links. */
function Group({
  role,
  links,
  archive,
}: {
  readonly role: LinkRole;
  readonly links: readonly AnyLink[];
  readonly archive: boolean;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{LINK_ROLE_HEADINGS[role]}</h3>
      <ul role="list" className="not-prose">
        {links.map(link => (
          <LinkRow key={link.url} link={link} archive={archive} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A piece's or a person's links grouped by role (plan §4.5, §4.6), each
 * role an h3 with its label, in the order of the API's roles, or with
 * `first` before the rest (a person's external profiles). A link with
 * several roles is listed under each (the API lists it once, with all its
 * roles). `archive: false` offers no archived copies (a restricted piece).
 */
export function LinkGroups({
  links,
  first = [],
  archive = true,
}: {
  readonly links: readonly AnyLink[];
  readonly first?: readonly LinkRole[];
  readonly archive?: boolean;
}) {
  const roles = [
    ...first,
    ...linkRoleSchema.options.filter(role => !first.includes(role)),
  ];
  return roles.map(role => {
    const under = links.filter(link => link.roles.includes(role));
    return under.length > 0 ? (
      <Group key={role} role={role} links={under} archive={archive} />
    ) : null;
  });
}
