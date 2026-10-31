import { redirect } from "@remix-run/cloudflare";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";
import { getOrCreateSessionStorage } from "./auth.server";
import type { AppEnv } from "./env.server";
import { safeReturnTo } from "./return-to.server";

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
const FIXTURE_USER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DEFAULT_FIXTURE_USER = "contributor";

/**
 * Sign in as fixture user `?as=<id>` (default the seeded contributor) and
 * redirect to `?returnTo`. Returns null, so the caller falls back to Auth0,
 * when the mode or host lock is not satisfied.
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

  const userId = url.searchParams.get("as") ?? DEFAULT_FIXTURE_USER;
  if (!FIXTURE_USER_ID.test(userId)) {
    return new Response("Unknown fixture user id", { status: 400 });
  }

  const sessionStorage = getOrCreateSessionStorage(env);
  const session = await sessionStorage.getSession();
  session.set("user", {
    id: `fixture|${userId}`,
    email: `${userId}@fixture.invalid`,
    accessToken: `fixture:${userId}`,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  console.warn(`[${STUB_AUTH_MARKER}] signed in as fixture user ${userId}`);

  return redirect(safeReturnTo(url.searchParams.get("returnTo")), {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}
