import type { components } from "../../app/api/schema.gen";

/** What an operation or control endpoint answers, before a transport sends it. */

type ErrorCode = components["schemas"]["Error"]["code"];

export type FixtureResponse = {
  readonly status: number;
  readonly body?: unknown;
  /**
   * Set only on an outage (see router.ts): `body` is then text of this
   * type, sent as-is, outside the spec.
   */
  readonly contentType?: string;
};

export function errorBody(
  code: ErrorCode,
  message: string
): components["schemas"]["Error"] {
  return { code, message };
}
