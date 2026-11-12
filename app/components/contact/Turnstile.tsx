import { useEffect, useRef } from "react";
import { useThemeChoice } from "~/contexts/ThemeChoiceContext";

/**
 * Cloudflare Turnstile's widget, for the contact form: it puts its token
 * in the form as `cf-turnstile-response`, and the API checks it. The
 * script is loaded once, after hydration, and the widget rendered
 * explicitly into a container React leaves empty, so the server's markup
 * and the hydrated page always match. Without JavaScript there is no token
 * and the form says so (see the contact route).
 */

type TurnstileApi = {
  readonly render: (
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly action: string;
      readonly theme: "auto" | "light" | "dark";
    }
  ) => string | undefined;
  readonly remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.addEventListener("load", () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error())
    );
    script.addEventListener("error", () => {
      loading = undefined;
      reject(new Error("Turnstile didn’t load"));
    });
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ siteKey }: { readonly siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { choice } = useThemeChoice();
  const theme = choice === "system" ? "auto" : choice;
  useEffect(() => {
    let widget: string | undefined;
    let live = true;
    loadTurnstile()
      .then(turnstile => {
        if (live && containerRef.current) {
          widget = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action: "contact",
            theme,
          });
        }
      })
      // A widget that can't load leaves no token; the action says so.
      .catch(() => undefined);
    return () => {
      live = false;
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [siteKey, theme]);
  return <div ref={containerRef} className="min-h-turnstile" />;
}
