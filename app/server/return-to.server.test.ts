import { describe, expect, it } from "vitest";
import { createReturnToCookie, safeReturnTo } from "./return-to.server";

const SECRET = "a-test-secret-of-at-least-32-characters";

describe("safeReturnTo", () => {
  it.each([
    ["/", "/"],
    ["/help", "/help"],
    ["/help/licence?tab=2#credit", "/help/licence?tab=2#credit"],
    ["/settings/", "/settings/"],
    ["/%252F%252Fevil.com", "/%252F%252Fevil.com"],
    ["/help/../settings", "/settings"],
  ])("keeps the same-site path %j", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["slash backslash", "/\\evil.com"],
    ["backslash slash", "\\/evil.com"],
    ["encoded double slash", "/%2F%2Fevil.com"],
    ["encoded lower-case double slash", "/%2f%2fevil.com"],
    ["encoded backslash", "/%5Cevil.com"],
    ["tab after slash", "/\t/evil.com"],
    ["newline after slash", "/\n/evil.com"],
    ["carriage return after slash", "/\r/evil.com"],
    ["encoded tab after slash", "/%09/evil.com"],
    ["NUL", "/\u0000evil"],
    ["DEL", "/\u007fevil"],
    ["absolute https URL", "https://evil.com"],
    ["absolute http URL", "http://evil.com/"],
    ["javascript: URL", "javascript:alert(1)"],
    ["data: URL", "data:text/html,hi"],
    ["relative path", "help"],
    ["empty", ""],
    ["very long", `/${"a".repeat(2000)}`],
    ["malformed escape", "/%E0%A4%A"],
    ["the sign-in route", "/auth/login"],
    ["the callback route", "/auth/callback?code=x"],
    ["a dot path into the sign-in route", "/help/../auth/login"],
  ])("rejects %s", (_name, value) => {
    expect(safeReturnTo(value)).toBe("/");
  });

  it.each([null, undefined, 42, ["/help"], { path: "/help" }])(
    "rejects the non-string %j",
    value => {
      expect(safeReturnTo(value)).toBe("/");
    }
  );
});

describe("createReturnToCookie", () => {
  it("is signed, HttpOnly, Secure, SameSite=Lax, site-wide and lasts 10 minutes", async () => {
    const setCookie = await createReturnToCookie(SECRET).serialize("/help");
    const attributes = setCookie.split("; ").slice(1);
    expect(setCookie).toMatch(/^__Host-bt_return_to=[^;]+;/);
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("SameSite=Lax");
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("Max-Age=600");
    expect(attributes.some(attribute => /^Domain=/i.test(attribute))).toBe(
      false
    );
  });

  it("round-trips a value", async () => {
    const cookie = createReturnToCookie(SECRET);
    const setCookie = await cookie.serialize("/help");
    expect(await cookie.parse(setCookie.split(";")[0] ?? "")).toBe("/help");
  });

  it("rejects a tampered or foreign-signed value", async () => {
    const cookie = createReturnToCookie(SECRET);
    const forged = await createReturnToCookie(
      "another-secret-of-at-least-32-chars"
    ).serialize("//evil.com");
    expect(await cookie.parse(forged.split(";")[0] ?? "")).toBeNull();

    const unsigned = `__Host-bt_return_to=${btoa(JSON.stringify("//evil.com"))}`;
    expect(await cookie.parse(unsigned)).toBeNull();
  });
});
