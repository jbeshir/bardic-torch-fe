import { describe, expectTypeOf, it } from "vitest";
import type { components, operations, paths } from "~/api/schema.gen";

/**
 * `app/api/schema.gen.ts` is generated from the spec by `gen:api` (and kept
 * current by `check:api`); these checks pin the parts FE1 relies on, so a
 * generator change that loses them fails typecheck and this file.
 */

type Schemas = components["schemas"];

describe("generated API types", () => {
  it("map the FE1 routes to their operations", () => {
    expectTypeOf<paths["/v1/me"]["get"]>().toEqualTypeOf<operations["getMe"]>();
    expectTypeOf<paths["/v1/me"]["patch"]>().toEqualTypeOf<
      operations["updateMe"]
    >();
  });

  it("type the error code as the spec's enum", () => {
    expectTypeOf<"method_not_allowed">().toMatchTypeOf<
      Schemas["Error"]["code"]
    >();
    expectTypeOf<"not_a_code">().not.toMatchTypeOf<Schemas["Error"]["code"]>();
  });
});
