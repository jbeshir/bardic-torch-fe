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
    expectTypeOf<paths["/v1/tokens"]["get"]>().toEqualTypeOf<
      operations["listAPITokens"]
    >();
    expectTypeOf<paths["/v1/tokens"]["post"]>().toEqualTypeOf<
      operations["createAPIToken"]
    >();
    expectTypeOf<paths["/v1/tokens/{token_id}"]["delete"]>().toEqualTypeOf<
      operations["revokeAPIToken"]
    >();
  });

  it("type nullable 3.1 properties as unions with null", () => {
    expectTypeOf<Schemas["APIToken"]["name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Schemas["APIToken"]["last_used_at"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Schemas["CreateAPITokenRequest"]>().toEqualTypeOf<{
      name?: string | null;
    }>();
  });

  it("type the error code as the spec's enum", () => {
    expectTypeOf<"token_limit_reached">().toMatchTypeOf<
      Schemas["Error"]["code"]
    >();
    expectTypeOf<"not_a_code">().not.toMatchTypeOf<Schemas["Error"]["code"]>();
  });
});
