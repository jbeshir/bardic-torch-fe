import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import frauncesLatin from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import type { ShouldRevalidateFunction } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { useEffect, useState, type ReactNode } from "react";
import { loadAccount } from "~/server/account.server";
import { SentryProvider } from "~/contexts/SentryContext";
import { useNonce } from "~/contexts/NonceContext";
import * as Sentry from "@sentry/remix";
import { NotFound, ServerError } from "~/components/ErrorPages";
import { HelpLinks } from "~/components/HelpLinks";
import { Wordmark } from "~/components/Wordmark";
import stylesheet from "~/styles/app.css?url";
import { THEME_COLOURS } from "~/styles/theme-colour.gen";
import { readTheme } from "~/server/theme.server";
import type { Theme } from "~/styles/tokens";
import { useThemeChoice } from "~/hooks/useThemeChoice";
import { ToastProvider } from "~/components/ui/Toast";
import { AppShell } from "~/components/AppShell";
import { LOGOUT_ACTION, ME_ACTION, type Account } from "~/constants/account";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  {
    rel: "preload",
    href: frauncesLatin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "manifest", href: "/site.webmanifest" },
];

/**
 * The theme is server-rendered from the cookie (and switched optimistically
 * while a new choice is saved), so the first paint is already right: no
 * theme script, nothing to flash.
 */
function ThemeMeta({ theme }: { theme: Theme | null }) {
  if (theme) {
    return (
      <>
        <meta name="color-scheme" content={theme} />
        <meta name="theme-color" content={THEME_COLOURS[theme]} />
      </>
    );
  }
  return (
    <>
      <meta name="color-scheme" content="light dark" />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: light)"
        content={THEME_COLOURS.light}
      />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: dark)"
        content={THEME_COLOURS.dark}
      />
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const nonce = useNonce();
  const choice = useThemeChoice();
  const theme = choice === "system" ? null : choice;
  return (
    <html lang="en" data-theme={theme ?? undefined}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ThemeMeta theme={theme} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

type LoaderData = {
  sentryDsn: string | undefined;
  /** The explicit theme from the cookie; null follows the device. */
  theme: Theme | null;
  /** Who is reading, for the account control on every page. */
  account: Account;
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // Resolving the session refreshes expiring tokens (and /v1/me can end
  // it); the updated session cookie must be forwarded on the response.
  const { account, headers } = await loadAccount(request, context);

  return json<LoaderData>(
    {
      sentryDsn: context.cloudflare.env.SENTRY_DSN,
      theme: readTheme(request),
      account,
    },
    { headers }
  );
};

/**
 * The root loader calls /v1/me, so it runs again only when the answer can
 * have changed (plan §0.7): after a display-name change, on the way into or
 * out of /auth (login, logout), and when asked to (Try again revalidates
 * the page it is on). Plain navigations and other submissions, including a
 * theme change (its fetcher result is used directly), keep the data.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  formAction,
  defaultShouldRevalidate,
}) => {
  if (formMethod) {
    const action = formAction ? new URL(formAction, currentUrl).pathname : "";
    return (
      (action === ME_ACTION && formMethod.toUpperCase() === "PATCH") ||
      action === LOGOUT_ACTION
    );
  }
  const isAuth = (url: URL) => url.pathname.startsWith("/auth/");
  if (isAuth(currentUrl) || isAuth(nextUrl)) return true;
  return currentUrl.href === nextUrl.href && defaultShouldRevalidate;
};

export default function App() {
  const { sentryDsn, account } = useLoaderData<LoaderData>();

  return (
    <SentryProvider dsn={sentryDsn}>
      <ToastProvider>
        <AppShell account={account}>
          <Outlet />
        </AppShell>
      </ToastProvider>
    </SentryProvider>
  );
}

/**
 * What the root's error boundary shows when nothing else can (DESIGN
 * §10.5): the page the shell itself would have failed on. A minimal
 * standalone page with the same stylesheet, the Wordmark home link, the
 * error body and the same HelpLinks as every page. A 404 thrown by a
 * loader gets the 404 body; anything else is reported to Sentry (when it
 * is set up) and shows its event id as the reference.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const { pathname } = useLocation();
  const [reference, setReference] = useState<string>();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (notFound) return;
    const eventId = Sentry.captureRemixErrorBoundaryError(error);
    setReference(Sentry.isInitialized() ? eventId : undefined);
  }, [error, notFound]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-canvas">
        <div className="mx-auto flex h-header max-w-shell items-center px-4 md:px-6">
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-md px-1"
          >
            <Wordmark />
          </a>
        </div>
      </header>
      <main
        id="content"
        className="mx-auto w-full max-w-shell flex-1 bg-surface px-4 md:px-6"
      >
        {notFound ? (
          <NotFound pathname={pathname} />
        ) : (
          <ServerError reference={reference} />
        )}
      </main>
      <footer className="border-t border-border bg-canvas py-8">
        <div className="mx-auto max-w-shell px-4 md:px-6">
          <HelpLinks />
        </div>
      </footer>
    </div>
  );
}
