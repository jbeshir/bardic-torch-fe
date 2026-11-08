import { Fragment } from "react";
import { formatNumber } from "~/catalogue/format";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import { WORK_ROLE_HEADINGS } from "~/constants/vocabulary";
import { CertaintyQualifier, creditLabel } from "~/components/piece/Credits";
import { creditRoleSchema, type Person } from "~/schemas/catalogue";

type Profile = NonNullable<Person["profile"]>;
type Work = Profile["works"][number];

function WorksTable({ works }: { readonly works: readonly Work[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Piece</th>
          <th scope="col">Credited for</th>
        </tr>
      </thead>
      <tbody>
        {works.map(work => (
          <tr key={`${work.piece.slug}:${work.role}:${work.part}`}>
            <td>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link to={`/pieces/${work.piece.slug}`}>
                  {work.piece.title}
                </Link>
                {work.piece.conservation_status === "unassessed" ? null : (
                  <ConservationBadge
                    status={work.piece.conservation_status}
                    size="sm"
                  />
                )}
              </span>
            </td>
            <td>
              {creditLabel(work)}
              <CertaintyQualifier certainty={work.certainty} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "and 5 more not listed here", when the API listed only some. */
export function MoreNotListed({
  shown,
  total,
}: {
  readonly shown: number;
  readonly total: number;
}) {
  return total > shown ? (
    <p className="text-caption text-fg-subtle">
      and {formatNumber(total - shown)} more not listed here
    </p>
  ) : null;
}

/**
 * A person's works (plan §4.6): a table of the pieces they are credited
 * for, each with its conservation badge, the credit's role and part, and
 * how sure it is. With two or more roles the table is split by role (in
 * the API's order of roles) under h3s, "Words (12)", "Tunes (3)". The API lists at most 200, and there is
 * no way to page past them (spec issue B6), so a longer list ends with
 * "and N more not listed here".
 */
export function Works({ profile }: { readonly profile: Profile }) {
  const roles = creditRoleSchema.options.filter(role =>
    profile.works.some(work => work.role === role)
  );
  return (
    <>
      {roles.length < 2 ? (
        <WorksTable works={profile.works} />
      ) : (
        roles.map(role => {
          const works = profile.works.filter(work => work.role === role);
          return (
            <Fragment key={role}>
              <h3>
                {WORK_ROLE_HEADINGS[role]} ({formatNumber(works.length)})
              </h3>
              <WorksTable works={works} />
            </Fragment>
          );
        })
      )}
      <MoreNotListed shown={profile.works.length} total={profile.works_total} />
    </>
  );
}
