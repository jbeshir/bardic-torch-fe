import { describe, expect, it } from "vitest";
import { aborted, isTimeout, parseJson, upstreamUrl } from "./upstream.server";

describe("upstream helpers", () => {
  it("upstreamUrl fills and percent-encodes path parameters", () => {
    expect(
      upstreamUrl("https://api.test", "/v1/pieces/{slug}", {
        slug: "a/b c",
      })
    ).toBe("https://api.test/v1/pieces/a%2Fb%20c");
  });

  it.each([
    ["", null],
    ['{"a":1}', { a: 1 }],
    ["<html>", undefined],
  ])("parseJson reads %j", (text, expected) => {
    expect(parseJson(text)).toEqual(expected);
  });

  it("aborted rejects with the reason once the signal aborts", async () => {
    const controller = new AbortController();
    const pending = aborted(controller.signal);
    controller.abort(new Error("stop"));
    await expect(pending).rejects.toThrow("stop");
  });

  it("isTimeout recognises a TimeoutError only", () => {
    expect(isTimeout(new DOMException("t", "TimeoutError"))).toBe(true);
    expect(isTimeout(new Error("t"))).toBe(false);
  });
});
