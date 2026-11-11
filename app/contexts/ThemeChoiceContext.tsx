import {
  createContext,
  useCallback,
  use,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sendForm } from "~/client/send-form";
import { THEME_ACTION, type ThemeChoice } from "~/constants/theme";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";

type ThemeChoiceState = {
  /**
   * The theme to show now: a choice still being saved wins, so the page
   * switches immediately; then the last choice saved on this page; then
   * the one the root loader read from the cookie.
   */
  readonly choice: ThemeChoice;
  /** Why the last save failed (the choice has reverted), until the next. */
  readonly failure: ProxyError | null;
  /** Save `choice`; resolves to the save's result. */
  readonly save: (choice: ThemeChoice) => Promise<ProxyBody<unknown>>;
};

const ThemeChoiceContext = createContext<ThemeChoiceState | null>(null);
ThemeChoiceContext.displayName = "ThemeChoiceContext";

/**
 * Holds the reader's theme choice for the document and every ThemeToggle.
 * A save is a plain `fetch` to the theme route (`sendForm`), not a React
 * Router fetcher: a failure of any kind, even a response the app didn't make or
 * no network, reverts the choice and is reported here, instead of being
 * thrown to the root's error boundary, which would replace the whole site.
 */
export function ThemeChoiceProvider({
  loaded,
  children,
}: {
  /** The choice the root loader read from the cookie. */
  readonly loaded: ThemeChoice;
  readonly children: ReactNode;
}) {
  const [pending, setPending] = useState<ThemeChoice | null>(null);
  const [saved, setSaved] = useState<ThemeChoice | null>(null);
  const [failure, setFailure] = useState<ProxyError | null>(null);
  const latestRef = useRef(0);

  const save = useCallback(async (choice: ThemeChoice) => {
    latestRef.current += 1;
    const request = latestRef.current;
    setPending(choice);
    setFailure(null);
    const result = await sendForm(THEME_ACTION, "POST", { theme: choice });
    // A later click has taken over; its own answer decides.
    if (request !== latestRef.current) return result;
    setPending(null);
    if (result.ok) setSaved(choice);
    else setFailure(result.error);
    return result;
  }, []);

  const value = useMemo(
    () => ({ choice: pending ?? saved ?? loaded, failure, save }),
    [pending, saved, loaded, failure, save]
  );
  return <ThemeChoiceContext value={value}>{children}</ThemeChoiceContext>;
}

export function useThemeChoice(): ThemeChoiceState {
  const state = use(ThemeChoiceContext);
  if (!state) throw new Error("useThemeChoice needs a ThemeChoiceProvider");
  return state;
}
