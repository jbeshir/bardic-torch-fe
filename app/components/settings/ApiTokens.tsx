import { useFetcher } from "@remix-run/react";
import { IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { components } from "~/api/schema.gen";
import { AlertRegion } from "~/components/ui/Alert";
import { Dialog } from "~/components/ui/Dialog";
import { EmptyState } from "~/components/ui/EmptyState";
import { useToast } from "~/components/ui/Toast";
import { tokenAction } from "~/constants/account";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";
import { CreateTokenForm } from "./CreateTokenForm";
import { ProblemAlert } from "./ProblemAlert";
import { fieldMessage, useFetcherResult } from "./results";
import { SettingsSection } from "./SettingsSection";
import { TokenList } from "./TokenList";
import { TokenReveal } from "./TokenReveal";

type Schemas = components["schemas"];
type APIToken = Schemas["APIToken"];

const CREATE_FAILED =
  "We couldn't create a token. Check your connection and try again.";
const REVOKE_FAILED =
  "We couldn't revoke that token. Check your connection and try again.";

/** What the confirm dialog calls a token: its name, or "token {prefix}…". */
function revokeDescription(token: APIToken): string {
  const called = token.name ? `‘${token.name}’` : `token ${token.prefix}…`;
  return `Anything using ${called} will stop working straight away. This can't be undone.`;
}

type Problem = { readonly error: ProxyError; readonly fallback: string };

/**
 * The API tokens section (DESIGN §10.3): the list (or its empty state), the
 * create form, the one-time reveal of a new token, and the revoke confirm.
 * Both mutations go through fetchers to the `/api/tokens` proxy routes; the
 * settings loader revalidates after them, so the list is always the API's.
 * Every failure shows a danger Alert next to the form (the token limit,
 * blocked, a token already gone, signed out, or the service's trouble).
 */
export function ApiTokens({ tokens }: { tokens: readonly APIToken[] }) {
  const show = useToast();
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
    }
  });

  useFetcherResult(revoke, result => {
    setRevoking(null);
    if (result.ok) {
      setProblem(null);
      show({ tone: "success", message: "Token revoked." });
    } else {
      setProblem({ error: result.error, fallback: REVOKE_FAILED });
    }
  });

  function confirmRevoke() {
    if (revoking) {
      revoke.submit({}, { method: "delete", action: tokenAction(revoking.id) });
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
      <div className="mt-6">
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
