import type { AppLoadContext } from "@remix-run/cloudflare";
import type { Account } from "~/constants/account";
import { getMe } from "./api.server";
import { getServerAuthContext } from "./auth.server";

/**
 * The reader's account for the root loader (plan §0.7): signed out without
 * a session; otherwise the profile from /v1/me. It never throws. An
 * upstream 401 has already cleared the session, so it reads as signed
 * out; a blocked account and any other failure get their own states.
 * `headers` (a refreshed or cleared session) must go on the response.
 */
export async function loadAccount(
  request: Request,
  context: AppLoadContext
): Promise<{ account: Account; headers: Headers }> {
  const auth = await getServerAuthContext(request, context);
  if (!auth.authContext.isAuthenticated) {
    return {
      account: { state: "signed-out" },
      headers: new Headers(auth.headers),
    };
  }

  const me = await getMe(request, context);
  if (me.ok) {
    return {
      account: { state: "signed-in", user: me.data },
      headers: me.headers,
    };
  }
  if (me.status === 401) {
    return { account: { state: "signed-out" }, headers: me.headers };
  }
  if (me.error.code === "user_blocked") {
    return {
      account: { state: "blocked", message: me.error.message },
      headers: me.headers,
    };
  }
  return { account: { state: "profile-unavailable" }, headers: me.headers };
}
