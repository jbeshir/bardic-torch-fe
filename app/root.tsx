import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import frauncesLatin from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import type { ShouldRevalidateFunction } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import type { ReactNode } from "react";
import { loadAccount } from "~/server/account.server";
import { SentryProvider } from "~/contexts/SentryContext";
import { useNonce } from "~/contexts/NonceContext";
import {
  ThemeChoiceProvider,
  useThemeChoice,
} from "~/contexts/ThemeChoiceContext";
import {
  NOT_FOUND_META,
  NotFound,
  ServerError,
  SERVER_ERROR_META,
} from "~/components/ErrorPages";
import { HelpLinks } from "~/components/HelpLinks";
import { Wordmark } from "~/components/Wordmark";
import stylesheet from "~/styles/app.css?url";
import { THEME_COLOURS } from "~/styles/theme-colour.gen";
import { readTheme } from "~/server/theme.server";
import type { Theme } from "~/styles/tokens";
import { useErrorReference } from "~/hooks/useErrorReference";
import { ToastProvider } from "~/components/ui/Toast";
import { AppShell } from "~/components/AppShell";
import {
  LOGOUT_ACTION,
  SETTINGS_INTENT,
  SETTINGS_PATH,
  type Account,
} from "~/constants/account";
import type { ProxyBody } from "~/schemas/proxy";

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
 * Every page titles itself. When the root's error boundary shows instead,
 * Remix renders only the root's meta, so it titles the error page (a
 * thrown 404 or anything else), on the server and after a client
 * navigation alike.
 */
export const meta: MetaFunction = ({ error }) => {
  if (!error) return [];
  return isRouteErrorResponse(error) && error.status === 404
    ? [...NOT_FOUND_META]
    : [...SERVER_ERROR_META];
};

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
  const loaded = useRouteLoaderData<typeof loader>("root")?.theme ?? "system";
  return (
    <ThemeChoiceProvider loaded={loaded}>
      <Document>{children}</Document>
    </ThemeChoiceProvider>
  );
}

function Document({ children }: { children: ReactNode }) {
  const nonce = useNonce();
  const { choice } = useThemeChoice();
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
 * have changed (plan §0.7): after a display-name change was saved, after a
 * settings call found the session ended (so the header shows "Log in"), on
 * the way into or out of /auth (login, logout), and when asked to (Try
 * again revalidates the page it is on). Plain navigations and other
 * submissions keep the data; a theme change doesn't go through the router.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  formAction,
  formData,
  actionResult,
  defaultShouldRevalidate,
}) => {
  if (formMethod) {
    const action = formAction ? new URL(formAction, currentUrl).pathname : "";
    if (action === LOGOUT_ACTION) return true;
    if (action !== SETTINGS_PATH) return false;
    const result = actionResult as ProxyBody<unknown> | undefined;
    if (result?.ok === false) return result.error.code === "unauthenticated";
    return (
      result?.ok === true &&
      formData?.get("intent") === SETTINGS_INTENT.updateProfile
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
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const reference = useErrorReference(error, !notFound);

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
