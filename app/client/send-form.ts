import {
  TRY_AGAIN_MESSAGE,
  type ProxyBody,
  type ProxyError,
} from "~/schemas/proxy";

/**
 * How the browser sends a mutation (the settings forms through the
 * settings route's `clientAction`, the theme toggle directly): a plain
 * `fetch` whose every outcome is a proxy body, so it always ends in
 * feedback on the page. React Router's own fetcher submission would throw a
 * response it didn't make (a platform 503, a gateway's 502) or a failed
 * fetch to the route's error boundary instead, replacing the page and the
 * reader's typed input.
 */

/** The request never got an answer: offline, or the connection broke. */
export const OFFLINE: ProxyError = {
  code: "offline",
  message: "You seem to be offline. Your changes haven’t been saved yet.",
};

/**
 * An answer the app didn't make (a platform error page, a gateway's 5xx)
 * or one that isn't a proxy body.
 */
const UNEXPECTED_RESPONSE: ProxyError = {
  code: "try_again",
  message: TRY_AGAIN_MESSAGE,
};

function isProxyBody(value: unknown): value is ProxyBody<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const body = value as { ok?: unknown; data?: unknown; error?: unknown };
  if (body.ok === true) return "data" in body;
  if (body.ok !== false) return false;
  const error = body.error as { code?: unknown; message?: unknown } | null;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

/**
 * Send `fields` form-encoded to the app's own `path` and read the proxy
 * body it answers. Never rejects.
 */
export async function sendForm(
  path: string,
  method: "PATCH" | "POST" | "DELETE",
  fields: Readonly<Record<string, string>>,
  signal?: AbortSignal
): Promise<ProxyBody<unknown>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      body: new URLSearchParams(fields),
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, error: OFFLINE };
  }
  const body: unknown = await response.json().catch(() => undefined);
  return isProxyBody(body) ? body : { ok: false, error: UNEXPECTED_RESPONSE };
}
