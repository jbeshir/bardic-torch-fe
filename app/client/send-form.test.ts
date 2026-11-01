import { afterEach, describe, expect, it, vi } from "vitest";
import { OFFLINE, sendForm } from "./send-form";

const UNEXPECTED = {
  ok: false,
  error: {
    code: "unexpected_response",
    message: "Bardic Torch sent an unexpected response. Try again shortly.",
  },
};

function answer(respond: () => Promise<Response>) {
  const fetch = vi.fn(async (_path: string, _init: RequestInit) => respond());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendForm", () => {
  it("sends the fields form-encoded to the app's own path", async () => {
    const fetch = answer(async () => Response.json({ ok: true, data: 1 }));
    const signal = new AbortController().signal;
    await sendForm("/api/me", "PATCH", { display_name: "Morwen" }, signal);

    const [path, init] = fetch.mock.calls[0] ?? [];
    expect(path).toBe("/api/me");
    expect(init?.method).toBe("PATCH");
    expect(String(init?.body)).toBe("display_name=Morwen");
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect(init?.signal).toBe(signal);
  });

  it.each([
    ["a success", 200, { ok: true, data: { id: "t1" } }],
    [
      "the proxy's own failure",
      409,
      { ok: false, error: { code: "token_limit_reached", message: "Ten." } },
    ],
  ])("passes on %s as it is", async (_case, status, body) => {
    answer(async () => Response.json(body, { status }));
    expect(await sendForm("/api/tokens", "POST", {})).toEqual(body);
  });

  it.each([
    ["a bare 503 from the platform", () => new Response("", { status: 503 })],
    [
      "a gateway's HTML error page",
      () =>
        new Response("<!doctype html><title>502</title>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    ["a 200 that isn't JSON", () => new Response("ok")],
    ["JSON that isn't a proxy body", () => Response.json({ data: 1 })],
    ["a success without data", () => Response.json({ ok: true })],
    [
      "a failure without a message",
      () => Response.json({ ok: false, error: { code: "x" } }),
    ],
  ])("reports %s as an unexpected response", async (_case, respond) => {
    answer(async () => respond());
    expect(await sendForm("/api/me", "PATCH", {})).toEqual(UNEXPECTED);
  });

  it("reports a fetch that fails (no network) as offline, without rejecting", async () => {
    answer(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await sendForm("/api/tokens/t1", "DELETE", {})).toEqual({
      ok: false,
      error: OFFLINE,
    });
    expect(OFFLINE.message).toBe(
      "You seem to be offline. Your changes haven't been saved yet."
    );
  });

  it("reports a body that breaks off as an unexpected response", async () => {
    answer(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"ok":'));
              controller.error(new TypeError("network reset"));
            },
          })
        )
    );
    expect(await sendForm("/api/me", "PATCH", {})).toEqual(UNEXPECTED);
  });
});
