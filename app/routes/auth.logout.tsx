import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import {
  getOrCreateSessionStorage,
  revokeRefreshToken,
} from "~/server/auth.server";
import { appEnvContext } from "~/server/context.server";
import { assertSameOrigin } from "~/server/csrf.server";

/**
 * Logout route - clears the session and redirects to Auth0 logout.
 *
 * POST only, from this site only: a link or a cross-site form cannot sign
 * the user out. The account panel's "Log out" form posts here as a full
 * document submission, so the browser follows the redirect to Auth0, which
 * CSP `form-action` allows, and Auth0 sends the reader back to this site.
 * The session's refresh token is revoked first (best effort, bounded), so a
 * copy of the cookie can't be renewed afterwards.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const env = context.get(appEnvContext);
  const sessionStorage = getOrCreateSessionStorage(env);
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const refreshToken = session.get("tokens")?.refreshToken;
  if (refreshToken) await revokeRefreshToken(refreshToken, env);

  const logoutURL = new URL(`https://${env.AUTH0_DOMAIN}/v2/logout`);
  logoutURL.searchParams.set("client_id", env.AUTH0_CLIENT_ID);
  logoutURL.searchParams.set("returnTo", new URL(request.url).origin);

  return redirect(logoutURL.toString(), {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

/**
 * GET requests to /auth/logout should redirect to home.
 * Only POST requests perform the logout action.
 */
export async function loader() {
  return redirect("/");
}
