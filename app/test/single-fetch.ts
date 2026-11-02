import { decode } from "turbo-stream";

/** An error response, as single fetch sends a thrown `data()` or Response. */
type DecodedErrorResponse = {
  readonly status: number;
  readonly statusText: string;
  readonly data: unknown;
};

/**
 * The body of a single fetch `.data` answer, decoded the way Remix's client
 * decodes it (turbo-stream with Remix's plugins): a loader answer has
 * `{ data } | { error }` by route id, an action answer one of them. An error
 * is a `DecodedErrorResponse` (for a thrown `data()` or
 * Response) or an `Error` (anything else, sanitised in production).
 */
export async function singleFetchResults(
  response: Response
): Promise<Readonly<Record<string, unknown>>> {
  if (!response.body) throw new Error("A .data answer has a body");
  const decoded = await decode(response.body, {
    plugins: [
      (type, ...values) => {
        if (type === "SanitizedError") {
          const [name, message, stack] = values as [string, string, string?];
          const error = new Error(message);
          error.name = name;
          if (stack !== undefined) error.stack = stack;
          return { value: error };
        }
        if (type === "ErrorResponse") {
          const [data, status, statusText] = values as [
            unknown,
            number,
            string,
          ];
          const value: DecodedErrorResponse = { status, statusText, data };
          return { value };
        }
        return undefined;
      },
      (type, value) => {
        if (type === "SingleFetchFallback") return { value: undefined };
        if (type === "SingleFetchClassInstance") return { value };
        return undefined;
      },
    ],
  });
  await decoded.done;
  return decoded.value as Readonly<Record<string, unknown>>;
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
