import { data } from "react-router";
import { describe, expect, it } from "vitest";
import {
  asPageFailure,
  detailFailure,
  failureInit,
  isPageFailure,
  listFailure,
  searchFailure,
  thrownPageFailure,
  type ReadFailure,
} from "./read-failure";

const resting = { kind: "resting", retryAfter: 60 };
const bad = { kind: "bad_gateway" };

describe("searchFailure", () => {
  it.each([
    [
      { status: 400, code: "invalid_request" },
      false,
      { kind: "invalid_filters" },
    ],
    [{ status: 500, code: "internal" }, true, { kind: "search_timeout" }],
    [{ status: 500, code: "internal" }, false, { kind: "server" }],
    [{ status: 503, code: undefined }, true, resting],
    [{ status: 500, code: "unavailable" }, true, resting],
    [{ status: 500, code: undefined }, true, bad],
    [{ status: 404, code: "not_found" }, false, bad],
    [{ status: 400, code: "request_too_large" }, false, bad],
    ["unreachable", false, { kind: "resting", retryAfter: 30 }],
  ] as const)("%o (filtered %s)", (upstream, filtered, expected) => {
    expect(searchFailure(upstream, { filtered })).toEqual(expected);
  });
});

describe("detailFailure", () => {
  it.each([
    [{ status: 404, code: "not_found" }, { kind: "not_found" }],
    [{ status: 400, code: "invalid_request" }, { kind: "not_found" }],
    [{ status: 500, code: "internal" }, { kind: "server" }],
    [{ status: 503, code: undefined }, resting],
    [{ status: 404, code: undefined }, bad],
    [{ status: 418, code: "internal" }, bad],
    ["unreachable", { kind: "resting", retryAfter: 30 }],
  ] as const)("%o", (upstream, expected) => {
    expect(detailFailure(upstream)).toEqual(expected);
  });
});

describe("listFailure", () => {
  it.each([
    [{ status: 500, code: "internal" }, { kind: "server" }],
    [{ status: 400, code: "invalid_request" }, bad],
    [{ status: 404, code: "not_found" }, bad],
    [{ status: 503, code: undefined }, resting],
    ["unreachable", { kind: "resting", retryAfter: 30 }],
  ] as const)("%o", (upstream, expected) => {
    expect(listFailure(upstream)).toEqual(expected);
  });
});

describe("page failures", () => {
  it.each([
    [{ kind: "resting", retryAfter: 60 }, 503, "60", true],
    [{ kind: "resting", retryAfter: 30 }, 503, "30", true],
    [{ kind: "server" }, 500, null, true],
    [{ kind: "bad_gateway" }, 502, null, true],
    [{ kind: "not_found" }, 404, null, true],
    [{ kind: "search_timeout" }, 500, null, false],
    [{ kind: "invalid_filters" }, 400, null, false],
  ] as const)("%o is %d", (failure: ReadFailure, status, retryAfter, page) => {
    const init = failureInit(failure);
    expect(init.status).toBe(status);
    expect(init.headers.get("Retry-After")).toBe(retryAfter);
    expect(isPageFailure(failure)).toBe(page);
  });

  it("are read back from a route's error response", () => {
    const response = (body: unknown, status: number) => ({
      status,
      statusText: "",
      internal: false,
      data: data(body, { status }).data,
    });
    expect(thrownPageFailure(response({ kind: "not_found" }, 404))).toEqual({
      kind: "not_found",
    });
    expect(thrownPageFailure(response({ kind: "resting" }, 503))).toEqual(
      resting
    );
    expect(thrownPageFailure(response({ kind: "other" }, 500))).toBeNull();
    expect(thrownPageFailure(new Error("boom"))).toBeNull();
  });

  it("reads a filter failure of a read with no filters as a contract break", () => {
    expect(asPageFailure({ kind: "server" })).toEqual({ kind: "server" });
    expect(asPageFailure({ kind: "invalid_filters" })).toEqual(bad);
    expect(asPageFailure({ kind: "search_timeout" })).toEqual(bad);
  });
});
