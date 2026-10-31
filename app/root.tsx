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
import { json } from "@remix-run/cloudflare";
import type { ReactNode } from "react";
import { getServerAuthContext } from "~/server/auth.server";
import { SentryProvider } from "~/contexts/SentryContext";
import { useNonce } from "~/contexts/NonceContext";
import { captureRemixErrorBoundaryError } from "@sentry/remix";
import stylesheet from "~/styles/app.css?url";
import { THEME_COLOURS } from "~/styles/theme-colour.gen";

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

export function Layout({ children }: { children: ReactNode }) {
  const nonce = useNonce();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // Resolving the auth context refreshes expiring tokens; the refreshed
  // session cookie must be forwarded on the response.
  const { headers } = await getServerAuthContext(request, context);

  return json<LoaderData>(
    { sentryDsn: context.cloudflare.env.SENTRY_DSN },
    headers ? { headers } : undefined
  );
};

export default function App() {
  const { sentryDsn } = useLoaderData<LoaderData>();

  return (
    <SentryProvider dsn={sentryDsn}>
      <Outlet />
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
