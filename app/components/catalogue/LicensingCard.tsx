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
 * `licensing_source` role).
 */
export function LicensingCard({
  subject,
  status,
  notes,
  sources,
}: {
  readonly subject: "piece" | "person";
  readonly status: LicensingStatus;
  readonly notes: MarkdownTree | null;
  readonly sources: readonly AnyLink[];
}) {
  return (
    <div className="not-prose my-8 flow-root">
      <Card title="Licensing" headingLevel={2} headingId={LICENSING_ID}>
        <div className="grid gap-3 text-body text-fg">
          <Status status={status} subject={subject} />
          {notes ? (
            <div className="prose-bt text-body wrap-anywhere">
              <UserMarkdown tree={notes} />
            </div>
          ) : null}
          {sources.length > 0 ? <Sources sources={sources} /> : null}
        </div>
      </Card>
    </div>
  );
}

function Sources({
  sources,
}: {
  readonly sources: readonly AnyLink[];
}): ReactNode {
  return (
    <div>
      <h3 className="font-sans text-label-caps uppercase text-fg-subtle">
        Sources
      </h3>
      <ul role="list">
        {sources.map(source => (
          <LinkRow key={source.url} link={source} />
        ))}
      </ul>
    </div>
  );
}
