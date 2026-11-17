import type { components } from "../../app/api/schema.gen";

/** What the fixture API answers, before a transport sends it. */

export type FixtureResponse = {
  readonly status: number;
  readonly body?: unknown;
};

export function errorBody(
  code: components["schemas"]["Error"]["code"],
  message: string
): components["schemas"]["Error"] {
  return { code, message };
}
