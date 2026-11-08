import { describe, expect, it } from "vitest";
import { catalogueHeaders } from "./headers";

function headersOf(init: {
  readonly parent?: Record<string, string>;
  readonly loader?: Record<string, string>;
  readonly error?: Record<string, string>;
}) {
  const result = catalogueHeaders({
    parentHeaders: new Headers(init.parent),
    loaderHeaders: new Headers(init.loader),
    actionHeaders: new Headers(),
    errorHeaders: init.error ? new Headers(init.error) : undefined,
  });
  return new Headers(result);
}

describe("catalogueHeaders", () => {
  it("passes on the root's Cache-Control, signed in", () => {
    const headers = headersOf({ parent: { "Cache-Control": "no-store" } });
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Retry-After")).toBeNull();
  });

  it("sets no Cache-Control of its own, signed out", () => {
    expect(headersOf({}).get("Cache-Control")).toBeNull();
  });

  it("adds the Retry-After of a thrown failure", () => {
    const headers = headersOf({
      parent: { "Cache-Control": "no-store" },
      error: { "Retry-After": "60" },
    });
    expect(headers.get("Retry-After")).toBe("60");
    expect(headers.get("Cache-Control")).toBe("no-store");
  });

  it("adds the Retry-After of a returned failure", () => {
    expect(
      headersOf({ loader: { "Retry-After": "30" } }).get("Retry-After")
    ).toBe("30");
  });

  it("passes on nothing else", () => {
    const headers = headersOf({
      parent: { "Set-Cookie": "a=b", "X-Other": "1" },
      loader: { "X-Loader": "1" },
    });
    expect([...headers.keys()]).toEqual([]);
  });
});
