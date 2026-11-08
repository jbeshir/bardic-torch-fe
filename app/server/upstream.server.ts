/**
 * Transport pieces shared by every server-side call to the Bardic Torch API:
 * the authenticated client (`api.server.ts`) and, from FE2, the anonymous
 * catalogue reads. Nothing here knows about sessions or schemas.
 */

import type { paths } from "~/api/schema.gen";

export type Method = "GET" | "PATCH" | "POST" | "DELETE";

/**
 * The (path, method) pair at which `paths` declares `operation`. Methods a
 * path doesn't have are typed `never` there, which would match anything,
 * so they are excluded first.
 */
export type EndpointOf<Operation> = {
  [Path in keyof paths]: {
    [M in Method]: [paths[Path][Lowercase<M>]] extends [never]
      ? never
      : [paths[Path][Lowercase<M>]] extends [Operation]
        ? { readonly path: Path; readonly method: M }
        : never;
  }[Method];
}[keyof paths];

/**
 * How long a call waits for the API (its answer and the whole body) before
 * giving up, so a hung upstream still ends in a visible error instead of a
 * button that stays busy.
 */
export const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * The absolute URL of `path` on `base`, with each `{name}` filled from
 * `params`, percent-encoded.
 */
export function upstreamUrl(
  base: string,
  path: string,
  params?: Readonly<Record<string, string>>
): string {
  return `${base}${path.replace(/\{(\w+)\}/g, (_match, name: string) =>
    encodeURIComponent(params?.[name] ?? "")
  )}`;
}

/** `text` as JSON: null when empty, undefined when it isn't JSON. */
export function parseJson(text: string): unknown {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Rejects with the signal's reason once it aborts. */
export function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

/** `AbortSignal.timeout` rejects with a DOMException named TimeoutError. */
export function isTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
}

/**
 * Whether an error answer means the API (or the platform in front of it) is
 * briefly out of service: any 503, whatever its body, or the Error code
 * `unavailable` at any status.
 */
export function isUnavailable(
  status: number,
  code: string | undefined
): boolean {
  return status === 503 || code === "unavailable";
}
