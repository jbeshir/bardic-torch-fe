import { IconCircleCheck, IconHelpCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { LinkRow, type AnyLink } from "~/components/links/LinkRow";
import { Card } from "~/components/ui/Card";
import { Link } from "~/components/ui/Link";
import { UserMarkdown } from "~/components/UserMarkdown";
import type { LicensingStatus } from "~/schemas/catalogue";
import type { MarkdownTree } from "~/schemas/markdown";

/** The id of the card's heading, which the infobox's Licensing row links to. */
export const LICENSING_ID = "licensing";

/** The licensing in a word, linked to the licensing card: "Known" or "Unknown". */
export function LicensingSummary({
  status,
}: {
  readonly status: LicensingStatus;
}) {
  return (
    <Link to={`#${LICENSING_ID}`}>
      {status === "known" ? "Known" : "Unknown"}
    </Link>
  );
}

/**
 * Whether the licence is known, with an icon that matches the words
 * (never the icon alone).
 */
function Status({
  status,
  subject,
}: {
  readonly status: LicensingStatus;
  readonly subject: "piece" | "person";
}) {
  const known = status === "known";
  const StatusIcon = known ? IconCircleCheck : IconHelpCircle;
  return (
    <p className="flex items-center gap-2 font-medium text-fg">
      <StatusIcon
        size={18}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-fg-muted"
      />
      {known
        ? "Licensing known"
        : subject === "piece"
          ? "We don’t know how this piece is licensed yet"
          : "We don’t know how this person licenses their work yet"}
    </p>
  );
}

/**
 * The licensing card (plan §4.5, §4.6), the page's "Licensing" section:
 * whether the licensing is known; the notes; the sources (the links with the
 * `licensing_source` role; for a restricted piece they are inside its
 * links' disclosure, so the card says where); and a note on etiquette,
 * linking to the bard preference checklist. The full etiquette card is
 * FE4's.
 */
export function LicensingCard({
  subject,
  status,
  notes,
  sources,
  sourcesHidden = false,
}: {
  readonly subject: "piece" | "person";
  readonly status: LicensingStatus;
  readonly notes: MarkdownTree | null;
  readonly sources: readonly AnyLink[];
  /** The sources are listed under the restricted piece's links instead. */
  readonly sourcesHidden?: boolean;
}) {
  return (
    <div className="not-prose my-8 flow-root">
      <Card title="Licensing" headingLevel={2} headingId={LICENSING_ID}>
        <div className="grid gap-3 text-body text-fg">
          <Status status={status} subject={subject} />
          {notes ? (
            <div className="prose-bt text-body">
              <UserMarkdown tree={notes} />
            </div>
          ) : null}
          {sources.length > 0 ? (
            <Sources sources={sources} hidden={sourcesHidden} />
          ) : null}
          <p className="text-caption text-fg-subtle">
            Ask the creator before recording or adapting a piece unless its
            licence says you may. See the{" "}
            <Link to="/help/bard-preference-checklist" appearance="inherit">
              bard preference checklist
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}

function Sources({
  sources,
  hidden,
}: {
  readonly sources: readonly AnyLink[];
  readonly hidden: boolean;
}): ReactNode {
  return (
    <div>
      <h3 className="font-sans text-label-caps uppercase text-fg-subtle">
        Sources
      </h3>
      {hidden ? (
        <p className="mt-1 text-body-sm text-fg-muted">
          Sources are listed under Where it has been recorded.
        </p>
      ) : (
        <ul role="list">
          {sources.map(source => (
            <LinkRow key={source.url} link={source} />
          ))}
        </ul>
      )}
    </div>
  );
}
