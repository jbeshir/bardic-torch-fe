import { IconTrash } from "@tabler/icons-react";
import type { components } from "~/api/schema.gen";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { useHydrated } from "~/hooks/useHydrated";
import { formatDate, tokenLabel } from "./format";

type APIToken = components["schemas"]["APIToken"];

function Prefix({ prefix }: { prefix: string }) {
  return <code className="font-mono text-code text-fg">{prefix}…</code>;
}

function When({ timestamp }: { timestamp: string | null }) {
  if (timestamp === null) return <>Never</>;
  return <time dateTime={timestamp}>{formatDate(timestamp)}</time>;
}

/** "Revoke", named "Revoke token {name}" for assistive tech. */
function RevokeButton({
  token,
  onRevoke,
}: {
  token: APIToken;
  onRevoke: (token: APIToken) => void;
}) {
  const hydrated = useHydrated();
  return (
    <Button
      variant="secondary-danger"
      size="sm"
      icon={IconTrash}
      disabled={!hydrated}
      aria-haspopup="dialog"
      onClick={() => onRevoke(token)}
    >
      Revoke<span className="sr-only"> token {tokenLabel(token)}</span>
    </Button>
  );
}

/**
 * The active API tokens, newest first (DESIGN §10.3): a table from md, a
 * list of cards below it. Only one of the two is displayed at a time, so
 * assistive tech meets each token once. Revoke opens the confirm dialog
 * (it needs JS, so it is disabled until the page has hydrated).
 */
export function TokenList({
  tokens,
  onRevoke,
}: {
  tokens: readonly APIToken[];
  onRevoke: (token: APIToken) => void;
}) {
  return (
    <>
      <table
        aria-label="Your API tokens"
        className="hidden w-full border-collapse text-left text-body-sm md:table"
      >
        <thead className="border-b border-border-strong text-fg-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Name
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Prefix
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Created
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Last used
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="text-fg">
          {tokens.map(token => (
            <tr key={token.id} className="border-b border-border">
              <th scope="row" className="wrap-anywhere py-3 pr-4 font-semibold">
                {tokenLabel(token)}
              </th>
              <td className="py-3 pr-4">
                <Prefix prefix={token.prefix} />
              </td>
              <td className="whitespace-nowrap py-3 pr-4">
                <When timestamp={token.created_at} />
              </td>
              <td className="whitespace-nowrap py-3 pr-4">
                <When timestamp={token.last_used_at} />
              </td>
              <td className="py-3 text-right">
                <RevokeButton token={token} onRevoke={onRevoke} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul
        role="list"
        aria-label="Your API tokens"
        className="wrap-anywhere flex flex-col gap-3 md:hidden"
      >
        {tokens.map(token => (
          <li key={token.id}>
            <Card title={tokenLabel(token)}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt>Prefix</dt>
                <dd className="text-fg">
                  <Prefix prefix={token.prefix} />
                </dd>
                <dt>Created</dt>
                <dd className="text-fg">
                  <When timestamp={token.created_at} />
                </dd>
                <dt>Last used</dt>
                <dd className="text-fg">
                  <When timestamp={token.last_used_at} />
                </dd>
              </dl>
              <div className="mt-3">
                <RevokeButton token={token} onRevoke={onRevoke} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
