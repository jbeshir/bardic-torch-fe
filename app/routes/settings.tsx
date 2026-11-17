import { useRouteError, useRouteLoaderData } from "react-router";
import type { HeadersFunction, MetaFunction } from "react-router";
import { IconLogin } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ServerError } from "~/components/ErrorPages";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { SectionError } from "~/components/ui/ErrorState";
import { loginHref, SETTINGS_PATH } from "~/constants/account";
import { useErrorReference } from "~/hooks/useErrorReference";
import type { loader as rootLoader } from "~/root";

/**
 * /settings: the display name, and where it comes from. Who is reading
 * comes from the root loader; nothing here can be changed or is cached.
 */

export const meta: MetaFunction = () => [
  { title: "Settings · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

/**
 * Nothing here is cached: single fetch gives a client navigation's `.data`
 * answer the same route headers as the document, so this covers both.
 */
export const headers: HeadersFunction = () => ({ "Cache-Control": "no-store" });

const NAME_SOURCE =
  "Your display name is the name on the Google or Facebook account you log in with. To change it, change it there; Bardic Torch shows the new name the next time you log in.";

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
      <p className="text-body text-fg">Log in to see your display name.</p>
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
            You can’t suggest edits.
          </Alert>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <SettingsSection title="Profile">
        {account.state === "signed-in" ? (
          <dl>
            <dt className="text-body-sm text-fg-muted">Display name</dt>
            <dd className="mt-1 text-body-lg text-fg">
              {account.user.display_name}
            </dd>
          </dl>
        ) : (
          <SectionError title="We couldn’t load your profile." />
        )}
        <p className="mt-4 text-body text-fg">{NAME_SOURCE}</p>
      </SettingsSection>
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const reference = useErrorReference(error, true);
  return (
    <ServerError title="We couldn’t load your settings" reference={reference} />
  );
}
