import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fieldMessage, problemMessage, useFetcherResult } from "./results";

describe("useFetcherResult", () => {
  it("reports each response once, only when the fetcher is idle again", () => {
    const onResult = vi.fn();
    const first = { ok: true };
    const second = { ok: false };
    const { rerender } = renderHook(
      ({ state, data }: { state: string; data: object | undefined }) =>
        useFetcherResult({ state, data }, onResult),
      {
        initialProps: { state: "idle" } as {
          state: string;
          data: object | undefined;
        },
      }
    );
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
  const error = {
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
  it.each(["internal", "unavailable", "bad_gateway", "upstream_unavailable"])(
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
  ])("keeps the proxy's specific copy for %s", code => {
    expect(problemMessage({ code, message: "Proxy copy" }, "Form copy")).toBe(
      "Proxy copy"
    );
  });
});
