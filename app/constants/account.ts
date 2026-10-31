import type { User } from "~/schemas/api";

/**
 * Who is reading, as the root loader saw it (DESIGN §6.25). A failed
 * profile load never stops the page: the account control says so instead.
 */
export type Account =
  | { readonly state: "signed-out" }
  | { readonly state: "signed-in"; readonly user: User }
  /** Signed in, but /v1/me failed: the panel offers "Try again". */
  | { readonly state: "profile-unavailable" }
  /** Signed in to a blocked account: `message` says what that means. */
  | { readonly state: "blocked"; readonly message: string };

export const ROLE_LABELS: Readonly<Record<User["role"], string>> = {
  contributor: "Contributor",
  moderator: "Moderator",
};

/** The sign-in link that brings the reader back to `returnTo` afterwards. */
export function loginHref(returnTo: string): string {
  return `/auth/login?${new URLSearchParams({ returnTo })}`;
}

/** Where the account panel's "Log out" form posts. */
export const LOGOUT_ACTION = "/auth/logout";

/** The proxy route that changes the display name. */
export const ME_ACTION = "/api/me";
