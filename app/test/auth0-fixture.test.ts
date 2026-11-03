import { describe, expect, it } from "vitest";
import { idToken, verifiesWithJwks } from "./auth0-fixture";

// The fake Auth0's own tokens are genuine: production never checks an ID
// token's signature (see auth0-fixture.ts), so the app's tests can't show it.
describe("the Auth0 fixture", () => {
  it("issues real RS256 ID tokens, whose signature its JWKS verifies", async () => {
    const token = await idToken();
    expect(await verifiesWithJwks(token)).toBe(true);
    expect(await verifiesWithJwks(`${token.slice(0, -2)}AA`)).toBe(false);
  });
});
