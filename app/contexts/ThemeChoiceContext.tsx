import {
  createContext,
  useCallback,
  useContext,
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
  /** Save `choice` (DESIGN §6.24); resolves to the save's result. */
  readonly save: (choice: ThemeChoice) => Promise<ProxyBody<unknown>>;
};

const ThemeChoiceContext = createContext<ThemeChoiceState | null>(null);

/**
 * Holds the reader's theme choice for the document and every ThemeToggle.
 * A save is a plain `fetch` to the theme route (`sendForm`), not a Remix
 * fetcher: a failure of any kind, even a response the app didn't make or
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
  const latest = useRef(0);

  const save = useCallback(async (choice: ThemeChoice) => {
    latest.current += 1;
    const request = latest.current;
    setPending(choice);
    setFailure(null);
    const result = await sendForm(THEME_ACTION, "POST", { theme: choice });
    // A later click has taken over; its own answer decides.
    if (request !== latest.current) return result;
    setPending(null);
    if (result.ok) setSaved(choice);
    else setFailure(result.error);
    return result;
  }, []);

  const value = useMemo(
    () => ({ choice: pending ?? saved ?? loaded, failure, save }),
    [pending, saved, loaded, failure, save]
  );
  return (
    <ThemeChoiceContext.Provider value={value}>
      {children}
    </ThemeChoiceContext.Provider>
  );
}

export function useThemeChoice(): ThemeChoiceState {
  const state = useContext(ThemeChoiceContext);
  if (!state) throw new Error("useThemeChoice needs a ThemeChoiceProvider");
  return state;
}
