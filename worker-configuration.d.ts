/**
 * The Pages Function's bindings, as Cloudflare passes them: untyped strings,
 * validated per request by app/server/env.server.ts. Plain-text values live
 * in wrangler.toml per environment; the secrets are set in the Pages
 * dashboard (docs/DEPLOY.md), and locally in .dev.vars.
 */
export interface Env {
  BARDIC_TORCH_API_BASE_URL: string;
  /** Secret. Signs the session and returnTo cookies; at least 32 characters. */
  AUTH_SESSION_SECRET: string;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  /** Secret. */
  AUTH0_CLIENT_SECRET: string;
  /** This site's origin; Auth0 returns to `${it}/auth/callback`. */
  AUTH0_DEFAULT_REDIRECT_URI: string;
  AUTH0_AUDIENCE: string;
  /** Optional secret. Without it nothing is sent to Sentry. */
  SENTRY_DSN?: string;
  /** Optional: `auth0` (default) or `stub`, which only dev and e2e builds honour. */
  AUTH_MODE?: string;
}
