import { HttpResponse } from "msw/http";
import type { operations } from "~/api/schema.gen";
import { contractResponse, offContractResponse } from "~/test/contract";

type HistoryOperation = Extract<keyof operations, `list${string}Revisions`>;

/**
 * What every entity's history loader throws for each way its read can fail
 * (the declared 404, 400 and 500, a network failure, a proxy's 503, a
 * malformed body), as `it.each` rows: why, the upstream answer, the failure
 * the route throws and its status. The same for the five History routes, so
 * a case added here runs against all of them.
 */
export function historyFailures(operation: HistoryOperation) {
  return [
    [
      "a 404",
      () =>
        contractResponse(operation, 404, { code: "not_found", message: "x" }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 400 after our own check",
      () =>
        contractResponse(operation, 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 500",
      () =>
        contractResponse(operation, 500, { code: "internal", message: "x" }),
      { kind: "server" },
      500,
    ],
    [
      "a network failure",
      () => HttpResponse.error(),
      { kind: "resting", retryAfter: 30 },
      503,
    ],
    [
      "a proxy's 503",
      () => new HttpResponse("down", { status: 503 }),
      { kind: "resting", retryAfter: 60 },
      503,
    ],
    [
      "a malformed body",
      () => offContractResponse(operation, 200, { data: [] }, "no total"),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const;
}

/** The redirects of a History route whose fixture has one page of revisions. */
export function historyRedirects(path: string) {
  return [
    ["page 1", "?page=1", 301, path],
    ["past the end", "?page=2", 302, path],
  ] as const;
}
