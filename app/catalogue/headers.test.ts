import { describe, expect, it } from "vitest";
import { catalogueHeaders } from "./headers";

const headersOf = (init: {
  parent?: Record<string, string>;
  loader?: Record<string, string>;
  error?: Record<string, string>;
}) =>
  new Headers(
    catalogueHeaders({
      parentHeaders: new Headers(init.parent),
      loaderHeaders: new Headers(init.loader),
      actionHeaders: new Headers(),
      errorHeaders: init.error ? new Headers(init.error) : undefined,
    })
  );

describe("catalogueHeaders", () => {
  it("passes on the root's Cache-Control and a thrown failure's Retry-After, nothing else", () => {
    const headers = headersOf({
      parent: { "Cache-Control": "no-store", "Set-Cookie": "a=b" },
      loader: { "Retry-After": "30", "X-Loader": "1" },
    });
    expect([...headers.keys()]).toEqual(["cache-control"]);
    expect(
      headersOf({ error: { "Retry-After": "60" } }).get("Retry-After")
    ).toBe("60");
    expect(headersOf({}).get("Cache-Control")).toBeNull();
  });
});
