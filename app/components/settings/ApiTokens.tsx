import { useFetcher } from "@remix-run/react";
import { IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { components } from "~/api/schema.gen";
import { Alert, AlertRegion } from "~/components/ui/Alert";
import { Dialog } from "~/components/ui/Dialog";
import { EmptyState } from "~/components/ui/EmptyState";
import { useToast } from "~/components/ui/Toast";
import { SETTINGS_INTENT, SETTINGS_PATH } from "~/constants/account";
import { useOfflineToast } from "~/hooks/useOfflineToast";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";
import { ACTIVE_TOKEN_LIMIT } from "~/schemas/rules";
import { CreateTokenForm } from "./CreateTokenForm";
import { ProblemAlert } from "./ProblemAlert";
import { fieldMessage, useFetcherResult } from "./results";
import { SettingsSection } from "./SettingsSection";
import { TokenList } from "./TokenList";
import { TokenReveal } from "./TokenReveal";

type Schemas = components["schemas"];
type APIToken = Schemas["APIToken"];

const CREATE_FAILED =
  "We couldn’t create a token. Check your connection and try again.";
const REVOKE_FAILED =
  "We couldn’t revoke that token. Check your connection and try again.";

/** What the confirm dialog calls a token: its name, or "token {prefix}…". */
function revokeDescription(token: APIToken): string {
  const called = token.name ? `‘${token.name}’` : `token ${token.prefix}…`;
  return `Anything using ${called} will stop working straight away. This can’t be undone.`;
}

type Problem = { readonly error: ProxyError; readonly fallback: string };

/**
 * The API tokens section (DESIGN §10.3): the list (or its empty state), the
 * create form, the one-time reveal of a new token, and the revoke confirm.
 * Both mutations go through fetchers to the settings route's `clientAction`
 * and on to the `/api/tokens` proxy routes; the settings loader revalidates
 * after they succeed, so the list is always the API's. Every failure shows
 * a danger Alert next to the form (the token limit, blocked, a token
 * already gone, signed out, the service's trouble or no network), and a
 * typed token name stays. The limit is shown before it is reached ("3 of
 * 10"), and at the limit the form gives way to a note saying to revoke one;
 * the API's 409 stays the backstop for a list that is out of date.
 */
export function ApiTokens({ tokens }: { tokens: readonly APIToken[] }) {
  const show = useToast();
  const reportOffline = useOfflineToast();
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const create = useFetcher<ProxyBody<Schemas["CreatedAPIToken"]>>();
  const [created, setCreated] = useState<Schemas["CreatedAPIToken"] | null>(
    null
  );
  const [nameError, setNameError] = useState<string | null>(null);

  const revoke = useFetcher<ProxyBody<null>>();
  const [revoking, setRevoking] = useState<APIToken | null>(null);

  const [problem, setProblem] = useState<Problem | null>(null);

  useFetcherResult(create, result => {
    if (result.ok) {
      setCreated(result.data);
      setNameError(null);
      setProblem(null);
      return;
    }
    const message = fieldMessage(result.error, "name");
    if (message) {
      setNameError(message);
      setProblem(null);
      nameInput.current?.focus();
    } else {
      setNameError(null);
      setProblem({ error: result.error, fallback: CREATE_FAILED });
      reportOffline(result.error);
    }
  });

  useFetcherResult(revoke, result => {
    setRevoking(null);
    if (result.ok) {
      setProblem(null);
      show({ tone: "success", message: "Token revoked." });
    } else {
      setProblem({ error: result.error, fallback: REVOKE_FAILED });
      reportOffline(result.error);
    }
  });

  function confirmRevoke() {
    if (revoking) {
      revoke.submit(
        { intent: SETTINGS_INTENT.revokeToken, tokenId: revoking.id },
        { method: "post", action: SETTINGS_PATH }
      );
    }
  }

  return (
    <SettingsSection title="API tokens" headingRef={heading}>
      <p className="mb-6 text-body-sm text-fg-muted">
        Tokens let tools, such as an MCP client, read and suggest edits on your
        behalf. Treat them like a password.
      </p>
      {tokens.length > 0 ? (
        <TokenList tokens={tokens} onRevoke={setRevoking} />
      ) : (
        <EmptyState title="No tokens yet">
          Create a token to let tools like an MCP client work with Bardic Torch
          for you.
        </EmptyState>
      )}
      {tokens.length > 0 ? (
        <p className="mt-4 text-body-sm text-fg-muted">
          You have {tokens.length} of {ACTIVE_TOKEN_LIMIT} API tokens.
        </p>
      ) : null}
      <div className="mt-6">
        {tokens.length >= ACTIVE_TOKEN_LIMIT ? (
          <Alert tone="info">
            That’s the most allowed. Revoke one to create another.
          </Alert>
        ) : (
          <CreateTokenForm
            key={created?.id}
            fetcher={create}
            inputRef={nameInput}
            fieldError={nameError}
            onInvalid={message => {
              setNameError(message);
              setProblem(null);
            }}
          />
        )}
      </div>
      <AlertRegion urgent>
        {problem ? (
          <div className="mt-4">
            <ProblemAlert error={problem.error} fallback={problem.fallback} />
          </div>
        ) : null}
      </AlertRegion>
      <AlertRegion>
        {created ? (
          <div className="mt-4">
            <TokenReveal
              key={created.id}
              secret={created.token}
              onDismiss={() => {
                setCreated(null);
                heading.current?.focus();
              }}
            />
          </div>
        ) : null}
      </AlertRegion>
      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke this token?"
        description={revoking ? revokeDescription(revoking) : ""}
        confirm={{
          label: "Revoke token",
          icon: IconTrash,
          variant: "danger",
          onConfirm: confirmRevoke,
        }}
        pending={revoke.state !== "idle"}
        fallbackFocus={() => heading.current}
      />
    </SettingsSection>
  );
}
