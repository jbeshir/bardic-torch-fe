import type { LoaderFunctionArgs } from "react-router";
import { startAuth0Login } from "~/server/auth.server";
import { appEnvContext } from "~/server/context.server";
import { createReturnToCookie, safeReturnTo } from "~/server/return-to.server";

/**
 * Login route - redirects to Auth0, remembering `?returnTo` (validated) in a
 * signed cookie for /auth/callback. Builds with stub auth compiled in sign in
 * fixture users here instead when AUTH_MODE=stub (see stub-auth.server.ts).
 *
 * Nothing else from this URL's query reaches Auth0: a stray `state` or
 * `code` here is ignored.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.get(appEnvContext);

  if (env.AUTH_MODE === "stub") {
    if (__STUB_AUTH__) {
      const { stubLogin } = await import("~/server/stub-auth.server");
      const response = await stubLogin(request, env);
      if (response) return response;
    } else {
      console.error(
        "AUTH_MODE=stub ignored: this build does not include stub auth"
      );
    }
  }

  const returnTo = safeReturnTo(
    new URL(request.url).searchParams.get("returnTo")
  );
  const { authorizationUrl, stateCookie } = await startAuth0Login(env);
  const headers = new Headers({ Location: authorizationUrl.href });
  headers.append("Set-Cookie", stateCookie);
  headers.append(
    "Set-Cookie",
    await createReturnToCookie(env.AUTH_SESSION_SECRET).serialize(returnTo)
  );
  return new Response(null, { status: 302, headers });
}
