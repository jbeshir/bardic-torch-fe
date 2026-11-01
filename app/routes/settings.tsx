import type {
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
  type ClientActionFunctionArgs,
  type ShouldRevalidateFunction,
} from "@remix-run/react";
import { IconLogin } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { components } from "~/api/schema.gen";
import { ServerError } from "~/components/ErrorPages";
import { ApiTokens } from "~/components/settings/ApiTokens";
import { ProfileForm } from "~/components/settings/ProfileForm";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { ErrorState, SectionError } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { sendForm } from "~/client/send-form";
import {
  loginHref,
  ME_ACTION,
  SETTINGS_INTENT,
  SETTINGS_PATH,
  tokenAction,
  TOKENS_ACTION,
} from "~/constants/account";
import { CONTACT_FORM_URL } from "~/constants/navigation";
import { useErrorReference } from "~/hooks/useErrorReference";
import type { loader as rootLoader } from "~/root";
import type { ProxyBody } from "~/schemas/proxy";
import { listApiTokens } from "~/server/api.server";

/**
 * /settings (DESIGN §10.3, plan §0.7): the display name and the API
 * tokens. The tokens are loaded here, server-side; who is reading comes
 * from the root loader, so /v1/me is not fetched twice. Changes need JS:
 * the forms' fetchers submit to this route's `clientAction`, which sends
 * them on to the /api proxy routes. Nothing here is cached.
 */

type SettingsData =
  | { readonly state: "signed-out" }
  | {
      readonly state: "ready";
      readonly tokens: readonly components["schemas"]["APIToken"][];
    }
  /** The API refused the token list (403): `message` says why. */
  | { readonly state: "tokens-refused"; readonly message: string };

export const meta: MetaFunction = () => [
  { title: "Settings · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

const NO_STORE = "no-store";

/** The document; the loader's own responses say the same for `?_data`. */
export const headers: HeadersFunction = () => ({ "Cache-Control": NO_STORE });

/**
 * Signed out (no session, or the API ended it) is a page state, as is a
 * 403; anything else that stops the list loading (a 500, an unreachable or
 * malformed API) is thrown to this route's error boundary. Every answer is
 * `no-store`: the `headers` export only covers the document, and a client
 * navigation's `?_data` response would otherwise be cacheable, leaving the
 * token list in the browser's cache after logout.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const result = await listApiTokens(request, context);
  const headers = new Headers(result.headers);
  headers.set("Cache-Control", NO_STORE);
  if (result.ok) {
    return json<SettingsData>(
      { state: "ready", tokens: result.data.data },
      { headers }
    );
  }
  if (result.status === 401) {
    return json<SettingsData>({ state: "signed-out" }, { headers });
  }
  if (result.status === 403) {
    return json<SettingsData>(
      { state: "tokens-refused", message: result.error.message },
      { headers }
    );
  }
  throw json(
    { message: result.error.message },
    { status: result.status, headers }
  );
}

/**
 * A settings form's submission, sent on to its proxy route (`sendForm`).
 * Whatever happens on the way (the proxy's own error, a platform 503, a
 * network failure) comes back as a proxy body for the form to show inline,
 * never as a thrown error that would replace the page and the reader's
 * input with this route's error boundary.
 */
export async function clientAction({
  request,
}: ClientActionFunctionArgs): Promise<ProxyBody<unknown>> {
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  switch (form.get("intent")) {
    case SETTINGS_INTENT.updateProfile:
      return sendForm(
        ME_ACTION,
        "PATCH",
        { display_name: field("display_name") },
        request.signal
      );
    case SETTINGS_INTENT.createToken:
      return sendForm(
        TOKENS_ACTION,
        "POST",
        { name: field("name") },
        request.signal
      );
    case SETTINGS_INTENT.revokeToken:
      return sendForm(
        tokenAction(field("tokenId")),
        "DELETE",
        {},
        request.signal
      );
    default:
      return {
        ok: false,
        error: { code: "invalid_request", message: "Unknown settings form." },
      };
  }
}

const TOKEN_INTENTS: ReadonlySet<unknown> = new Set([
  SETTINGS_INTENT.createToken,
  SETTINGS_INTENT.revokeToken,
]);

/** Token answers after which the list on the page is known to be out of date. */
const LIST_OUT_OF_DATE: ReadonlySet<string> = new Set([
  "not_found",
  "token_limit_reached",
]);

/**
 * The list only changes when a token is created or revoked: it is
 * reloaded after a token form succeeds, or finds the list out of date (the
 * token already gone, or the limit reached from another tab, so the page
 * shows the tenth token and the count agrees with the API's answer).
 * After any other outcome nothing changed, and reloading could only fail
 * the same way (into the error boundary). A display-name change or a theme
 * choice leaves it alone.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  formData,
  actionResult,
  defaultShouldRevalidate,
}) => {
  if (formMethod) {
    const result = actionResult as ProxyBody<unknown> | undefined;
    return (
      TOKEN_INTENTS.has(formData?.get("intent")) &&
      (result?.ok === true || LIST_OUT_OF_DATE.has(result?.error.code ?? ""))
    );
  }
  return defaultShouldRevalidate;
};

function Page({ children }: { readonly children: ReactNode }) {
  return (
    <div className="max-w-form">
      <h1 className="text-h1 text-fg">Settings</h1>
      {children}
    </div>
  );
}

function SignedOut() {
  return (
    <div className="mt-6">
      <p className="text-body text-fg">
        Log in to change your display name and manage your API tokens.
      </p>
      <div className="mt-4">
        <ButtonLink
          to={loginHref(SETTINGS_PATH)}
          reloadDocument
          variant="primary"
          icon={IconLogin}
        >
          Log in
        </ButtonLink>
      </div>
    </div>
  );
}

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const account = useRouteLoaderData<typeof rootLoader>("root")?.account ?? {
    state: "signed-out",
  };

  if (data.state === "signed-out" || account.state === "signed-out") {
    return (
      <Page>
        <SignedOut />
      </Page>
    );
  }
  if (account.state === "blocked") {
    return (
      <Page>
        <div className="mt-6">
          <Alert tone="danger" title="Your account is blocked" headingLevel={2}>
            You can’t change your settings or suggest edits. If you think this
            is a mistake,{" "}
            <Link to={CONTACT_FORM_URL} appearance="inherit">
              contact the Bardic Torch team
            </Link>
            .
          </Alert>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <noscript>
        <div className="mt-6">
          <Alert tone="warning">
            Changing your settings needs JavaScript. Everything else on Bardic
            Torch works without it.
          </Alert>
        </div>
      </noscript>
      <SettingsSection title="Profile">
        {account.state === "signed-in" ? (
          <ProfileForm user={account.user} />
        ) : (
          <SectionError title="We couldn’t load your profile.">
            Your display name can be changed once it loads.
          </SectionError>
        )}
      </SettingsSection>
      {data.state === "ready" ? (
        <ApiTokens tokens={data.tokens} />
      ) : (
        <SettingsSection title="API tokens">
          <Alert tone="danger">{data.message}</Alert>
        </SettingsSection>
      )}
    </Page>
  );
}

/**
 * The token list couldn't load (R27): this boundary replaces the page's
 * content only, so the shell, the account menu and the theme toggle (all
 * from the root) still work. It reports to Sentry like the root boundary.
 */
/**
 * A form posted to the page itself (only possible without JS, since the
 * settings forms need it) has no server action to answer it: Remix's 405
 * says so, plainly, rather than as a failure to load. Anything else is
 * the settings failing to load.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const posted = isRouteErrorResponse(error) && error.status === 405;
  const reference = useErrorReference(error, !posted);
  if (posted) {
    return (
      <ErrorState
        title="Changing your settings needs JavaScript"
        actions={
          <ButtonLink to={SETTINGS_PATH} reloadDocument variant="primary">
            Back to settings
          </ButtonLink>
        }
      >
        <p>
          Nothing was changed. Turn JavaScript on, then make the change again.
          Everything else on Bardic Torch works without it.
        </p>
      </ErrorState>
    );
  }
  return (
    <ServerError title="We couldn’t load your settings" reference={reference} />
  );
}
