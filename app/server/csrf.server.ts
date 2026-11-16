import { jsonResponse } from "./json.server";

/**
 * Reject cross-site requests to state-changing routes. A request passes when
 * its `Origin` is exactly this site's origin or, for browsers that omit
 * `Origin`, when `Sec-Fetch-Site` says it came from this origin. Anything
 * else, including a sibling subdomain or `Origin: null`, gets a 403.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  const sameOrigin =
    origin === null
      ? request.headers.get("Sec-Fetch-Site") === "same-origin"
      : origin === new URL(request.url).origin;
  if (sameOrigin) return;

  throw jsonResponse(
    {
      ok: false,
      error: {
        code: "forbidden",
        message: "This request must come from the Bardic Torch site.",
      },
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
