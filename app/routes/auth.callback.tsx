import type { LoaderFunctionArgs } from "react-router";
import {
  completeAuth0Login,
  getOrCreateSessionStorage,
} from "~/server/auth.server";
import { appEnvContext } from "~/server/context.server";
import { createReturnToCookie, safeReturnTo } from "~/server/return-to.server";

/**
 * Auth callback route - handles the OAuth redirect from Auth0.
 *
 * Checks the state against this sign-in's cookie, exchanges the
 * authorization code for tokens, creates the session and redirects to the
 * returnTo stored by /auth/login, validated again here. A returnTo in this
 * URL's query string is ignored.
 *
 * If sign-in doesn't complete (the reader cancelled at Auth0, the state
 * doesn't match, or the code exchange fails), the reader goes back to the
 * same page, still logged out, where "Log in" is offered again. Nothing
 * here may be cached: the response carries the session.
 */
export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const env = context.get(appEnvContext);
  const returnToCookie = createReturnToCookie(env.AUTH_SESSION_SECRET);
  const cookieHeader = request.headers.get("Cookie");
  const returnTo = safeReturnTo(await returnToCookie.parse(cookieHeader));

  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: returnTo,
  });
  headers.append(
    "Set-Cookie",
    await returnToCookie.serialize("", { maxAge: 0 })
  );

  const { outcome, clearStateCookie } = await completeAuth0Login(
    request,
    url,
    env
  );
  if (clearStateCookie) headers.append("Set-Cookie", clearStateCookie);

  switch (outcome.kind) {
    case "signed-in": {
      const sessionStorage = getOrCreateSessionStorage(env);
      const session = await sessionStorage.getSession(cookieHeader);
      session.set("tokens", outcome.tokens);
      headers.append("Set-Cookie", await sessionStorage.commitSession(session));
      break;
    }
    case "cancelled":
      console.warn("Sign-in cancelled or refused at Auth0");
      break;
    case "failed":
      console.error("Authentication callback error:", outcome.error);
      break;
  }
  return new Response(null, { status: 302, headers });
}
