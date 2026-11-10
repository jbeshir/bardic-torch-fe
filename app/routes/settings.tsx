import {
  isRouteErrorResponse,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import type {
  ClientActionFunctionArgs,
  HeadersFunction,
  MetaFunction,
} from "react-router";
import { IconLogin } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ServerError } from "~/components/ErrorPages";
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
} from "~/constants/account";
import { CONTACT_FORM_URL } from "~/constants/navigation";
import { useErrorReference } from "~/hooks/useErrorReference";
import type { loader as rootLoader } from "~/root";
import type { ProxyBody } from "~/schemas/proxy";

/**
 * /settings (DESIGN §10.3, plan §0.7): the display name. Who is reading
 * comes from the root loader. Changes need JS: the form's fetcher submits
 * to this route's `clientAction`, which sends it on to the /api proxy
 * route. Nothing here is cached.
 */

export const meta: MetaFunction = () => [
  { title: "Settings · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

const NO_STORE = "no-store";

/**
 * Nothing here is cached: single fetch gives a client navigation's `.data`
 * answer the same route headers as the document, so this covers both.
 */
export const headers: HeadersFunction = () => ({ "Cache-Control": NO_STORE });

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
    default:
      return {
        ok: false,
        error: { code: "invalid_request", message: "Unknown settings form." },
      };
  }
}

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
      <p className="text-body text-fg">Log in to change your display name.</p>
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
  const account = useRouteLoaderData<typeof rootLoader>("root")?.account ?? {
    state: "signed-out",
  };

  if (account.state === "signed-out") {
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
    </Page>
  );
}

/**
 * A form posted to the page itself (only possible without JS, since the
 * settings forms need it) has no server action to answer it: React Router's 405
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
