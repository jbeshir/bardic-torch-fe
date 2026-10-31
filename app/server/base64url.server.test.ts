import { describe, it, expect } from "vitest";
import { decodeBase64Url } from "./base64url.server";

function encodeBase64Url(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("decodeBase64Url", () => {
  it("decodes unpadded base64url", () => {
    expect(decodeBase64Url("aGVsbG8")).toBe("hello");
  });

  it("decodes the URL-safe alphabet", () => {
    const text = "???>>>~~~";
    const encoded = encodeBase64Url(text);
    expect(encoded).toMatch(/[-_]/);
    expect(decodeBase64Url(encoded)).toBe(text);
  });

  it("decodes multi-byte UTF-8", () => {
    expect(decodeBase64Url(encodeBase64Url("Zoë — 詩"))).toBe("Zoë — 詩");
  });

  it("decodes a JWT payload segment", () => {
    const payload = JSON.stringify({ sub: "auth0|abc", email: "a@b.example" });
    expect(JSON.parse(decodeBase64Url(encodeBase64Url(payload)))).toEqual({
      sub: "auth0|abc",
      email: "a@b.example",
    });
  });
});
