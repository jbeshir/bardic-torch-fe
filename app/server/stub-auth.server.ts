import { redirect } from "@remix-run/cloudflare";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";
import { getOrCreateSessionStorage } from "./auth.server";
import type { AppEnv } from "./env.server";
import { safeReturnTo } from "./return-to.server";
import { createNonce, withSecurityHeaders } from "./security-headers.server";

/**
 * Stub sign-in for local development and e2e runs against the fixture API.
 *
 * Three locks keep it out of real deployments: this module is only compiled
 * into builds with `__STUB_AUTH__` (development and e2e; check:prod-build
 * proves production and preview lack it), it only acts with
 * `AUTH_MODE=stub`, and only for requests to localhost or 127.0.0.1.
 */

/**
 * Appears in every build that includes this module; check:prod-build reads
 * it from this file and fails if a production or preview build contains it.
 */
const STUB_AUTH_MARKER = "bardic-torch-stub-auth";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
/** A fixture user id; the chooser's input repeats it as an HTML pattern. */
const FIXTURE_USER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The fixture API's seeded users (test/fixture-api/data.ts), for the chooser. */
const SEEDED_USERS = [
  { id: "contributor", label: "the seeded contributor" },
  { id: "moderator", label: "the seeded moderator" },
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stubLoginHref(userId: string, returnTo: string): string {
  return `/auth/login?${new URLSearchParams({ as: userId, returnTo })}`;
}

/**
 * The page "Log in" opens in a stub build: pick a fixture user. It has no
 * scripts or styles, so it is plain HTML under the site's CSP. Users made
 * with `POST /__fixtures/users` are signed in by typing their id.
 */
function chooserPage(returnTo: string, env: AppEnv): Response {
  const links = SEEDED_USERS.map(
    user =>
      `<li><a href="${escapeHtml(stubLoginHref(user.id, returnTo))}">Log in as ${user.label} (<code>${user.id}</code>)</a></li>`
  ).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Choose a fixture user · Bardic Torch</title>
</head>
<body>
<main>
<h1>Choose a fixture user</h1>
<p>This build signs in with fixture users from the fixture API instead of Auth0. Real deployments never include this page.</p>
<ul>${links}</ul>
<form method="get" action="/auth/login">
<p><label for="fixture-user">Another fixture user’s id</label></p>
<p><input id="fixture-user" name="as" required pattern="[a-z0-9][a-z0-9\\-]{0,63}" autocomplete="off"></p>
<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
<p><button type="submit">Log in</button></p>
</form>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: withSecurityHeaders(
      new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      }),
      { env, nonce: createNonce(), development: false }
    ),
  });
}

/**
 * Sign in as fixture user `?as=<id>` and redirect to `?returnTo`; without
 * `?as`, show the chooser. Returns null, so the caller falls back to
 * Auth0, when the mode or host lock is not satisfied.
 */
export async function stubLogin(
  request: Request,
  env: AppEnv
): Promise<Response | null> {
  if (env.AUTH_MODE !== "stub") return null;

  const url = new URL(request.url);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    console.error(
      `[${STUB_AUTH_MARKER}] AUTH_MODE=stub ignored for host ${url.hostname}`
    );
    return null;
  }

  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const userId = url.searchParams.get("as");
  if (userId === null) return chooserPage(returnTo, env);
  if (!FIXTURE_USER_ID.test(userId)) {
    return new Response("Unknown fixture user id", { status: 400 });
  }

  const sessionStorage = getOrCreateSessionStorage(env);
  const session = await sessionStorage.getSession();
  session.set("tokens", {
    accessToken: `fixture:${userId}`,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  console.warn(`[${STUB_AUTH_MARKER}] signed in as fixture user ${userId}`);

  return redirect(returnTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}
