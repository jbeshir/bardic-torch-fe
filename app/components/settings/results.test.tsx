import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProxyBody, ProxyError, ProxyErrorCode } from "~/schemas/proxy";
import { fieldMessage, problemMessage, useFetcherResult } from "./results";

type Body = ProxyBody<unknown>;

type Props = { state: string; data: Body | undefined };

function renderResult(onResult: (result: Body) => void) {
  return renderHook(
    ({ state, data }: Props) => useFetcherResult({ state, data }, onResult),
    { initialProps: { state: "idle", data: undefined } as Props }
  );
}

describe("useFetcherResult", () => {
  it("reports each response once, only when the fetcher is idle again", () => {
    const onResult = vi.fn();
    const first: Body = { ok: true, data: null };
    const second: Body = {
      ok: false,
      error: { code: "internal", message: "Try again shortly." },
    };
    const { rerender } = renderResult(onResult);
    expect(onResult).not.toHaveBeenCalled();

    rerender({ state: "submitting", data: undefined });
    rerender({ state: "loading", data: first });
    expect(onResult).not.toHaveBeenCalled();
    rerender({ state: "idle", data: first });
    rerender({ state: "idle", data: first });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenLastCalledWith(first);

    rerender({ state: "submitting", data: first });
    rerender({ state: "idle", data: second });
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(second);
  });
});

describe("fieldMessage", () => {
  const error: ProxyError = {
    code: "invalid_request",
    message: "Check the highlighted fields.",
    fields: [
      { field: "name", message: "Token names can be up to 128 characters." },
    ],
  };

  it("finds the message for a field", () => {
    expect(fieldMessage(error, "name")).toBe(
      "Token names can be up to 128 characters."
    );
  });

  it("is null for another field, or a failure with no fields", () => {
    expect(fieldMessage(error, "display_name")).toBeNull();
    expect(fieldMessage({ code: "internal", message: "x" }, "name")).toBeNull();
  });
});

describe("problemMessage", () => {
  it.each([
    "internal",
    "unavailable",
    "bad_gateway",
    "upstream_unavailable",
    "unexpected_response",
    "offline",
  ] satisfies ProxyErrorCode[])(
    "uses the form's own words when the service had trouble (%s)",
    code => {
      expect(problemMessage({ code, message: "Proxy copy" }, "Form copy")).toBe(
        "Form copy"
      );
    }
  );

  it.each([
    "token_limit_reached",
    "user_blocked",
    "not_found",
    "unauthenticated",
  ] satisfies ProxyErrorCode[])(
    "keeps the proxy's specific copy for %s",
    code => {
      expect(problemMessage({ code, message: "Proxy copy" }, "Form copy")).toBe(
        "Proxy copy"
      );
    }
  );
});
