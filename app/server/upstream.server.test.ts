import { describe, expect, it } from "vitest";
import {
  aborted,
  isTimeout,
  isUnavailable,
  parseJson,
  upstreamUrl,
} from "./upstream.server";

describe("upstreamUrl", () => {
  it("fills and percent-encodes path parameters", () => {
    expect(
      upstreamUrl("https://api.test", "/v1/tokens/{token_id}", {
        token_id: "a/b c",
      })
    ).toBe("https://api.test/v1/tokens/a%2Fb%20c");
  });

  it("leaves a path without parameters alone", () => {
    expect(upstreamUrl("https://api.test", "/v1/me")).toBe(
      "https://api.test/v1/me"
    );
  });
});

describe("parseJson", () => {
  it.each([
    ["", null],
    ['{"a":1}', { a: 1 }],
    ["<html>", undefined],
  ])("reads %j", (text, expected) => {
    expect(parseJson(text)).toEqual(expected);
  });
});

describe("aborted", () => {
  it("rejects with the reason once the signal aborts", async () => {
    const controller = new AbortController();
    const pending = aborted(controller.signal);
    controller.abort(new Error("stop"));
    await expect(pending).rejects.toThrow("stop");
  });

  it("rejects at once for a signal that has aborted", async () => {
    await expect(aborted(AbortSignal.abort(new Error("gone")))).rejects.toThrow(
      "gone"
    );
  });
});

describe("isTimeout", () => {
  it("recognises a TimeoutError only", () => {
    expect(isTimeout(new DOMException("t", "TimeoutError"))).toBe(true);
    expect(isTimeout(new Error("t"))).toBe(false);
    expect(isTimeout(null)).toBe(false);
  });
});

describe("isUnavailable", () => {
  it.each([
    [503, undefined, true],
    [503, "internal", true],
    [500, "unavailable", true],
    [500, "internal", false],
    [404, undefined, false],
  ])("%i with code %s is %s", (status, code, expected) => {
    expect(isUnavailable(status, code)).toBe(expected);
  });
});
