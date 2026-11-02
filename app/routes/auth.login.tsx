import type { LoaderFunctionArgs } from "react-router";
import { getOrCreateAuthenticator } from "~/server/auth.server";
import { appEnvContext } from "~/server/context.server";
import type { AppEnv } from "~/server/env.server";
import { createReturnToCookie, safeReturnTo } from "~/server/return-to.server";

/**
 * Login route - redirects to Auth0, remembering `?returnTo` (validated) in a
 * signed cookie for /auth/callback. Builds with stub auth compiled in sign in
 * fixture users here instead when AUTH_MODE=stub (see stub-auth.server.ts).
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
  const auth0Redirect = await startAuth0Login(request, env);
  const headers = new Headers(auth0Redirect.headers);
  headers.append(
    "Set-Cookie",
    await createReturnToCookie(env.AUTH_SESSION_SECRET).serialize(returnTo)
  );
  return new Response(null, { status: auth0Redirect.status, headers });
}

/**
 * The strategy answers a request without `?state` by throwing its redirect to
 * Auth0. The query is dropped so a stray `state` or `code` on this URL can
 * never make it attempt a code exchange.
 */
async function startAuth0Login(request: Request, env: AppEnv) {
  const loginRequest = new Request(new URL("/auth/login", request.url), {
    headers: request.headers,
  });
  try {
    await getOrCreateAuthenticator(env).authenticate("auth0", loginRequest);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error("Auth0 strategy did not redirect to the authorize endpoint");
}
