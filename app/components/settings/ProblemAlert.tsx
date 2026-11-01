import { IconLogin } from "@tabler/icons-react";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { loginHref, SETTINGS_PATH } from "~/constants/account";
import type { ProxyError } from "~/schemas/proxy";
import { problemMessage } from "./results";

/**
 * A failed settings call, as a danger Alert (DESIGN §10.3, §11.2): what
 * happened and what to do. When the session has ended it offers "Log in",
 * which comes back to Settings.
 */
export function ProblemAlert({
  error,
  fallback,
}: {
  error: ProxyError;
  /** The form's own words for a failure on the service's side. */
  fallback: string;
}) {
  return (
    <Alert
      tone="danger"
      actions={
        error.code === "unauthenticated" ? (
          <ButtonLink
            to={loginHref(SETTINGS_PATH)}
            reloadDocument
            size="sm"
            icon={IconLogin}
          >
            Log in
          </ButtonLink>
        ) : undefined
      }
    >
      {problemMessage(error, fallback)}
    </Alert>
  );
}
