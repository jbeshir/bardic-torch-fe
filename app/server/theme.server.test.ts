import { describe, expect, it } from "vitest";
import { readTheme, themeCookie } from "./theme.server";

function withCookie(cookie?: string) {
  return new Request("https://app.test/", {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

describe("the theme cookie", () => {
  it.each([
    ["theme=dark", "dark"],
    ["theme=light", "light"],
    ["__Host-bt_session=abc; theme=dark; other=1", "dark"],
    [undefined, null],
    ["theme=system", null],
    ["theme=sepia", null],
    ["theme=Dark", null],
    ["mytheme=dark", null],
  ])("reads %j as %s", (cookie, theme) => {
    expect(readTheme(withCookie(cookie))).toBe(theme);
  });

  it.each([
    ["light", "theme=light", "Max-Age=31536000"],
    ["dark", "theme=dark", "Max-Age=31536000"],
    [null, "theme=", "Max-Age=0"],
  ] as const)(
    "writes %s as %s (%s) with HttpOnly, Secure, SameSite=Lax and Path=/",
    (theme, pair, maxAge) => {
      const [first, ...flags] = themeCookie(theme)
        .split(";")
        .map(part => part.trim());
      expect(first).toBe(pair);
      expect(flags).toEqual(
        expect.arrayContaining([maxAge, "Path=/", "HttpOnly", "Secure"])
      );
      expect(flags).toContain("SameSite=Lax");
    }
  );
});
