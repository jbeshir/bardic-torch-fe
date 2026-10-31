import { describe, expect, it } from "vitest";
import { readTheme, themeCookie } from "./theme.server";

function withCookie(cookie?: string) {
  return new Request("https://app.test/", {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

describe("readTheme", () => {
  it.each([
    ["theme=dark", "dark"],
    ["theme=light", "light"],
    ["__Host-bt_session=abc; theme=dark; other=1", "dark"],
    ["  theme=light  ;x=y", "light"],
  ] as const)("reads %j as %s", (cookie, theme) => {
    expect(readTheme(withCookie(cookie))).toBe(theme);
  });

  it.each([
    ["no Cookie header", undefined],
    ["no theme cookie", "__Host-bt_session=abc"],
    ["an empty value", "theme="],
    ["System, which is never stored", "theme=system"],
    ["an unknown value", "theme=sepia"],
    ["a different case", "theme=Dark"],
    ["a lookalike name", "mytheme=dark"],
  ])("treats %s as System (null)", (_label, cookie) => {
    expect(readTheme(withCookie(cookie))).toBeNull();
  });
});

describe("themeCookie", () => {
  function attributes(header: string) {
    const [pair = "", ...flags] = header.split(";").map(part => part.trim());
    return { pair, flags };
  }

  it.each(["light", "dark"] as const)(
    "stores %s for a year with HttpOnly, Secure, SameSite=Lax and Path=/",
    theme => {
      const { pair, flags } = attributes(themeCookie(theme));
      expect(pair).toBe(`theme=${theme}`);
      expect(flags).toEqual(
        expect.arrayContaining([
          "Max-Age=31536000",
          "Path=/",
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
        ])
      );
      expect(flags).toHaveLength(5);
    }
  );

  it("deletes the cookie for System, with the same flags", () => {
    const { pair, flags } = attributes(themeCookie(null));
    expect(pair).toBe("theme=");
    expect(flags).toEqual(
      expect.arrayContaining([
        "Max-Age=0",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
      ])
    );
  });

  it("round-trips through readTheme", () => {
    for (const theme of ["light", "dark"] as const) {
      const [pair = ""] = themeCookie(theme).split(";");
      expect(readTheme(withCookie(pair))).toBe(theme);
    }
  });
});
