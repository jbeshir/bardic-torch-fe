export interface Env {
  BARDIC_TORCH_API_BASE_URL: string;
  AUTH_SESSION_SECRET: string;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_DEFAULT_REDIRECT_URI: string;
  AUTH0_AUDIENCE: string;
  SENTRY_DSN?: string;
  AUTH_MODE?: string;
}
