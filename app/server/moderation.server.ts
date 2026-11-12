import { redirect, type RouterContextProvider } from "react-router";
import { loginHref } from "~/constants/account";
import { getMe, MODERATORS_ONLY } from "./api.server";
import { assertSameOrigin } from "./csrf.server";

/**
 * What the moderators' pages share. Their reads are moderation API calls,
 * which answer 403 `moderator_required` to anyone else, so the API's role
 * is the gate: the page shows that answer's copy in place of its content.
 * Their writes are document POSTs to the page's own action.
 */

/** Signed out (an upstream 401) goes to log in and back to this page. */
export function redirectSignedOut(
  result: { readonly status: number; readonly headers: Headers },
  url: URL
): void {
  if (result.status === 401) {
    throw redirect(loginHref(`${url.pathname}${url.search}`), {
      headers: result.headers,
    });
  }
}

/**
 * For a moderator's page that reads nothing from the API until asked
 * (takedown, blocking): the reader's role from `/v1/me`. Signed out goes
 * to log in; anyone but a moderator gets the moderators-only copy.
 */
export async function moderatorCheck(
  request: Request,
  context: Readonly<RouterContextProvider>,
  url: URL
): Promise<{ readonly error: string | null; readonly headers: Headers }> {
  const me = await getMe(request, context);
  redirectSignedOut(me, url);
  const error = me.ok
    ? me.data.role === "moderator"
      ? null
      : MODERATORS_ONLY.message
    : me.error.message;
  return { error, headers: me.headers };
}

/** A posted form, after the same-origin check; null when it can't be read. */
export async function postedForm(request: Request): Promise<FormData | null> {
  assertSameOrigin(request);
  return request.formData().catch(() => null);
}

/** What an action says when the form isn't one we made. */
export const UNREADABLE_FORM =
  "We couldn’t read the form. Reload the page and try again.";
