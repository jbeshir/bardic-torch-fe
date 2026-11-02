import { createContext, useContext } from "react";

/**
 * The CSP nonce of the current server render, provided by entry.server so the
 * root layout can put it on Remix's inline scripts. Undefined in the browser,
 * which never needs it after hydration.
 */
export const NonceContext = createContext<string | undefined>(undefined);
NonceContext.displayName = "NonceContext";

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
