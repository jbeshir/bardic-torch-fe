import {
  isRouteErrorResponse,
  UNSAFE_decodeViaTurboStream,
} from "react-router";

/** An error response, as single fetch sends a thrown `data()` or Response. */
type DecodedErrorResponse = {
  readonly status: number;
  readonly statusText: string;
  readonly data: unknown;
};

/** A decoded route result, with an error response as plain data. */
function plain(result: object): Readonly<Record<string, unknown>> {
  if (!("error" in result) || !isRouteErrorResponse(result.error)) {
    return { ...result };
  }
  const { status, statusText, data } = result.error;
  const error: DecodedErrorResponse = { status, statusText, data };
  return { ...result, error };
}

/**
 * The body of a single fetch `.data` answer, decoded the way React Router's
 * client decodes it: a loader answer has `{ data } | { error }` by route id,
 * an action answer one of them. An error is a `DecodedErrorResponse` (for a
 * thrown `data()` or Response) or an `Error` (anything else, sanitised in
 * production).
 */
export async function singleFetchResults(
  response: Response
): Promise<Readonly<Record<string, unknown>>> {
  if (!response.body) throw new Error("A .data answer has a body");
  const decoded = await UNSAFE_decodeViaTurboStream(response.body, globalThis);
  await decoded.done;
  const value = decoded.value;
  if (typeof value !== "object" || value === null) {
    throw new Error(`A .data answer decodes to an object: ${String(value)}`);
  }
  if ("error" in value || "data" in value) return plain(value);
  return Object.fromEntries(
    Object.entries(value).map(([routeId, result]: [string, unknown]) => [
      routeId,
      typeof result === "object" && result !== null ? plain(result) : result,
    ])
  );
}

/** One route's loader data from a `.data` answer; fails if it threw. */
export async function routeData(
  response: Response,
  routeId: string
): Promise<unknown> {
  const result = (await singleFetchResults(response))[routeId];
  if (typeof result !== "object" || result === null || !("data" in result)) {
    throw new Error(`No data for ${routeId}: ${String(result)}`);
  }
  return result.data;
}
