import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeChoiceProvider } from "~/contexts/ThemeChoiceContext";
import { Turnstile } from "./Turnstile";

const SITE_KEY = "1x00000000000000000000AA";

afterEach(() => {
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("loads the script once, renders the contact widget in the theme, and removes it when it goes", async () => {
    const turnstile = {
      render: vi.fn(() => "widget-1"),
      remove: vi.fn(),
    };
    const { unmount } = render(
      <ThemeChoiceProvider loaded="dark">
        <Turnstile siteKey={SITE_KEY} />
      </ThemeChoiceProvider>
    );
    const scripts = document.head.querySelectorAll(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    expect(scripts).toHaveLength(1);

    window.turnstile = turnstile;
    scripts[0]?.dispatchEvent(new Event("load"));
    await waitFor(() => {
      expect(turnstile.render).toHaveBeenCalledWith(expect.any(HTMLElement), {
        sitekey: SITE_KEY,
        action: "contact",
        theme: "dark",
      });
    });

    unmount();
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
  });
});
