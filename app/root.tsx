import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import frauncesLatin from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import type { ShouldRevalidateFunction } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import type { ReactNode } from "react";
import { loadAccount } from "~/server/account.server";
import { SentryProvider } from "~/contexts/SentryContext";
import { useNonce } from "~/contexts/NonceContext";
import { captureRemixErrorBoundaryError } from "@sentry/remix";
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
 * Global error boundary for unhandled errors.
 * Rendered inside `Layout`, so only the inner content is returned.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  captureRemixErrorBoundaryError(error);

  let title = "Something went wrong";
  let message = "An unexpected error occurred. Please try again later.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      message = "The page you’re looking for doesn’t exist.";
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  }

  return (
    <main>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to="/">Back to home</Link>
    </main>
  );
}
