import { describe, expect, it } from "vitest";
import { createReturnToCookie, safeReturnTo } from "./return-to.server";

const SECRET = "a-test-secret-of-at-least-32-characters";

describe("safeReturnTo", () => {
  it.each([
    ["/help/licence?tab=2#credit", "/help/licence?tab=2#credit"],
    ["/%252F%252Fevil.com", "/%252F%252Fevil.com"],
    ["/help/../settings", "/settings"],
  ])("keeps the same-site path %j", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["slash backslash", "/\\evil.com"],
    ["encoded double slash", "/%2F%2Fevil.com"],
    ["encoded backslash", "/%5Cevil.com"],
    ["tab after slash", "/\t/evil.com"],
    ["encoded tab after slash", "/%09/evil.com"],
    ["control character", "/\u0000evil"],
    ["absolute URL", "https://evil.com"],
    ["javascript: URL", "javascript:alert(1)"],
    ["relative path", "help"],
    ["very long", `/${"a".repeat(2000)}`],
    ["malformed escape", "/%E0%A4%A"],
    ["the sign-in route", "/auth/login"],
    ["a dot path into the sign-in route", "/help/../auth/login"],
    ["a percent-encoded sign-in route", "/%61uth/login"],
    ["a non-string", 42],
    ["a list", ["/help"]],
    ["null", null],
  ])("rejects %s", (_name, value) => {
    expect(safeReturnTo(value)).toBe("/");
  });
});

describe("createReturnToCookie", () => {
  it("is signed, HttpOnly, Secure, SameSite=Lax, site-wide and lasts 10 minutes", async () => {
    const setCookie = await createReturnToCookie(SECRET).serialize("/help");
    const attributes = setCookie.split("; ").slice(1);
    expect(setCookie).toMatch(/^__Host-bt_return_to=[^;]+;/);
    expect(attributes).toEqual(
      expect.arrayContaining([
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=600",
      ])
    );
  });

  it("round-trips a value and rejects a tampered or foreign-signed one", async () => {
    const cookie = createReturnToCookie(SECRET);
    const setCookie = await cookie.serialize("/help");
    expect(await cookie.parse(setCookie.split(";")[0] ?? "")).toBe("/help");

    const forged = await createReturnToCookie(
      "another-secret-of-at-least-32-chars"
    ).serialize("//evil.com");
    expect(await cookie.parse(forged.split(";")[0] ?? "")).toBeNull();
    const unsigned = `__Host-bt_return_to=${btoa(JSON.stringify("//evil.com"))}`;
    expect(await cookie.parse(unsigned)).toBeNull();
  });
});
