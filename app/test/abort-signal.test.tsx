import { Form } from "@remix-run/react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderRoutes } from "./router";

/**
 * jsdom's own AbortSignal next to Node's fetch broke every client-side
 * navigation and submission on Node ≥ 24: undici ≥ 7 rejects a signal that
 * isn't its own (`Expected signal to be an instance of AbortSignal`), and the
 * router builds each navigation's `new Request(url, { signal })`. Vitest ≥ 4
 * gives the jsdom environment Node's AbortController, so they match. This
 * fails again if that ever regresses, on whichever Node runs it.
 */
describe("the DOM test environment's AbortSignal", () => {
  it("is accepted by Request", () => {
    const { signal } = new AbortController();
    expect(new Request("http://localhost/", { signal }).signal).toBeInstanceOf(
      AbortSignal
    );
  });

  it("lets a <Form method=post> submission reach its route action", async () => {
    const action = vi.fn(async () => null);
    await renderRoutes([
      {
        id: "root",
        path: "*",
        action,
        element: (
          <Form method="post">
            <button type="submit">Send</button>
          </Form>
        ),
      },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
