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
  throwPageFailure,
  type ReadFailure,
} from "./read-failure";

const plain = { filtered: false };
const filtered = { filtered: true };

describe("searchFailure (plan §3.3)", () => {
  it.each([
    [
      "400 invalid_request",
      { status: 400, code: "invalid_request" },
      plain,
      { kind: "invalid_filters" },
    ],
    [
      "500 internal with q or a filter",
      { status: 500, code: "internal" },
      filtered,
      { kind: "search_timeout" },
    ],
    [
      "500 internal on the plain A–Z",
      { status: 500, code: "internal" },
      plain,
      { kind: "server" },
    ],
    [
      "503 with an Error body",
      { status: 503, code: "unavailable" },
      plain,
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "503 with no Error body",
      { status: 503, code: undefined },
      filtered,
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "unavailable at 500",
      { status: 500, code: "unavailable" },
      filtered,
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "a 500 without an Error body",
      { status: 500, code: undefined },
      filtered,
      { kind: "bad_gateway" },
    ],
    [
      "a 404 the op doesn't declare",
      { status: 404, code: "not_found" },
      plain,
      { kind: "bad_gateway" },
    ],
    [
      "a 400 with another code",
      { status: 400, code: "request_too_large" },
      plain,
      { kind: "bad_gateway" },
    ],
    [
      "a 502 from a gateway",
      { status: 502, code: undefined },
      plain,
      { kind: "bad_gateway" },
    ],
  ] as const)("%s", (_why, upstream, options, expected) => {
    expect(searchFailure(upstream, options)).toEqual(expected);
  });

  it("is resting for a request that got no answer, with a shorter wait", () => {
    expect(searchFailure("unreachable", plain)).toEqual({
      kind: "resting",
      retryAfter: 30,
    });
  });
});

describe("failureInit", () => {
  it.each([
    [{ kind: "resting", retryAfter: 60 }, 503, "60"],
    [{ kind: "resting", retryAfter: 30 }, 503, "30"],
    [{ kind: "server" }, 500, null],
    [{ kind: "bad_gateway" }, 502, null],
    [{ kind: "search_timeout" }, 500, null],
    [{ kind: "invalid_filters" }, 400, null],
  ] as const)("%o is %d", (failure: ReadFailure, status, retryAfter) => {
    const init = failureInit(failure);
    expect(init.status).toBe(status);
    expect(init.headers.get("Retry-After")).toBe(retryAfter);
  });
});

describe("page failures", () => {
  it("are the ones a page can't show around its content", () => {
    expect(isPageFailure({ kind: "resting", retryAfter: 30 })).toBe(true);
    expect(isPageFailure({ kind: "server" })).toBe(true);
    expect(isPageFailure({ kind: "bad_gateway" })).toBe(true);
    expect(isPageFailure({ kind: "search_timeout" })).toBe(false);
    expect(isPageFailure({ kind: "invalid_filters" })).toBe(false);
  });

  it("are thrown with their status and Retry-After, and read back", () => {
    let thrown: unknown;
    try {
      throwPageFailure({ kind: "resting", retryAfter: 30 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      type: "DataWithResponseInit",
      data: { kind: "resting", retryAfter: 30 },
      init: { status: 503 },
    });
  });

  it("are read back from a route's error response", () => {
    const response = (body: unknown, status: number) => {
      // What useRouteError gives a boundary for a thrown data().
      const thrown = data(body, { status });
      return {
        status,
        statusText: "",
        internal: false,
        data: thrown.data,
      };
    };
    expect(thrownPageFailure(response({ kind: "server" }, 500))).toEqual({
      kind: "server",
    });
    expect(
      thrownPageFailure(response({ kind: "resting", retryAfter: 30 }, 503))
    ).toEqual({ kind: "resting", retryAfter: 30 });
    expect(thrownPageFailure(response({ kind: "resting" }, 503))).toEqual({
      kind: "resting",
      retryAfter: 60,
    });
    expect(thrownPageFailure(response(null, 404))).toBeNull();
    expect(thrownPageFailure(response({ kind: "other" }, 500))).toBeNull();
    expect(thrownPageFailure(new Error("boom"))).toBeNull();
    expect(thrownPageFailure(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Track C: other lists, details and histories

describe("listFailure (listTerms, listEvents)", () => {
  it.each([
    ["500 internal", { status: 500, code: "internal" }, { kind: "server" }],
    // The loader sends only values it checked: the API disagrees with us.
    [
      "400 invalid_request",
      { status: 400, code: "invalid_request" },
      { kind: "bad_gateway" },
    ],
    [
      "503 of any body",
      { status: 503, code: undefined },
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "unavailable at another status",
      { status: 500, code: "unavailable" },
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "404 not_found",
      { status: 404, code: "not_found" },
      { kind: "bad_gateway" },
    ],
    [
      "500 without an Error body",
      { status: 500, code: undefined },
      { kind: "bad_gateway" },
    ],
  ] as const)("maps %s", (_name, upstream, expected) => {
    expect(listFailure(upstream)).toEqual(expected);
  });

  it("maps no answer to resting for 30 s", () => {
    expect(listFailure("unreachable")).toEqual({
      kind: "resting",
      retryAfter: 30,
    });
  });
});

describe("detailFailure (getTerm, getCollection, getEvent, histories, getRevision)", () => {
  it.each([
    [
      "404 not_found",
      { status: 404, code: "not_found" },
      { kind: "not_found" },
    ],
    // After the loader's own address check: the address still leads nowhere.
    [
      "400 invalid_request",
      { status: 400, code: "invalid_request" },
      { kind: "not_found" },
    ],
    ["500 internal", { status: 500, code: "internal" }, { kind: "server" }],
    [
      "503",
      { status: 503, code: undefined },
      { kind: "resting", retryAfter: 60 },
    ],
    [
      "404 without an Error body",
      { status: 404, code: undefined },
      { kind: "bad_gateway" },
    ],
    ["418", { status: 418, code: "internal" }, { kind: "bad_gateway" }],
  ] as const)("maps %s", (_name, upstream, expected) => {
    expect(detailFailure(upstream)).toEqual(expected);
  });

  it("maps no answer to resting for 30 s", () => {
    expect(detailFailure("unreachable")).toEqual({
      kind: "resting",
      retryAfter: 30,
    });
  });

  it("is a page failure, answered 404", () => {
    expect(isPageFailure({ kind: "not_found" })).toBe(true);
    expect(failureInit({ kind: "not_found" }).status).toBe(404);
  });

  it("is read back from a thrown 404", () => {
    const thrown = data({ kind: "not_found" }, { status: 404 });
    expect(
      thrownPageFailure({
        status: 404,
        statusText: "",
        internal: false,
        data: thrown.data,
      })
    ).toEqual({ kind: "not_found" });
  });
});

describe("asPageFailure", () => {
  it("keeps a page failure", () => {
    expect(asPageFailure({ kind: "server" })).toEqual({ kind: "server" });
    expect(asPageFailure({ kind: "not_found" })).toEqual({ kind: "not_found" });
  });

  it("reads a filter failure of a read with no filters as a contract break", () => {
    expect(asPageFailure({ kind: "invalid_filters" })).toEqual({
      kind: "bad_gateway",
    });
    expect(asPageFailure({ kind: "search_timeout" })).toEqual({
      kind: "bad_gateway",
    });
  });
});
