import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  getOrCreateAuthenticator,
  getOrCreateSessionStorage,
} from "~/server/auth.server";
import { createReturnToCookie, safeReturnTo } from "~/server/return-to.server";

/**
 * Auth callback route - handles the OAuth redirect from Auth0.
 *
 * Exchanges the authorization code for tokens, creates the session and
 * redirects to the returnTo stored by /auth/login, validated again here. A
 * returnTo in this URL's query string is ignored.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const returnToCookie = createReturnToCookie(env.AUTH_SESSION_SECRET);
  const cookieHeader = request.headers.get("Cookie");
  const returnTo = safeReturnTo(await returnToCookie.parse(cookieHeader));

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    await returnToCookie.serialize("", { maxAge: 0 })
  );

  try {
    const user = await getOrCreateAuthenticator(env).authenticate(
      "auth0",
      request
    );
    const sessionStorage = getOrCreateSessionStorage(env);
    const session = await sessionStorage.getSession(cookieHeader);
    session.set("user", user);
    headers.append("Set-Cookie", await sessionStorage.commitSession(session));
    headers.set("Location", returnTo);
  } catch (error) {
    console.error("Authentication callback error:", error);
    headers.set("Location", "/");
  }
  return new Response(null, { status: 302, headers });
}
