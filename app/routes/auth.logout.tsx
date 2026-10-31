import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import { assertSameOrigin } from "~/server/csrf.server";

/**
 * Logout route - clears the session and redirects to Auth0 logout.
 *
 * POST only, from this site only: a link or a cross-site form cannot sign
 * the user out.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const env = context.cloudflare.env;
  const sessionStorage = getOrCreateSessionStorage(env);
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const logoutURL = new URL(`https://${env.AUTH0_DOMAIN}/v2/logout`);
  logoutURL.searchParams.set("client_id", env.AUTH0_CLIENT_ID);
  logoutURL.searchParams.set("returnTo", new URL(request.url).origin);

  return redirect(logoutURL.toString(), {
    headers: {
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
