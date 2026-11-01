import { z } from "zod";

/**
 * The Worker's environment, validated on every request. Bindings arrive as
 * untyped strings, so a missing or malformed value fails here with the
 * variable's name instead of deep inside a loader.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * How wrangler.toml and .dev.vars.example mark a value still to be filled
 * in. A deploy that forgot one gets the configuration error page, not a
 * site whose sign-in fails at Auth0.
 */
const PLACEHOLDER_PREFIX = "replace-with";

/** A string that isn't one of the repository's placeholders. */
const filledIn = z
  .string()
  .refine(
    value => !value.startsWith(PLACEHOLDER_PREFIX),
    "Still a placeholder: set the real value"
  );

const emptyAsMissing = (value: unknown) => (value === "" ? undefined : value);

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const httpUrl = filledIn
  .refine(isHttpUrl, "Must be an http(s) URL")
  .transform(value => value.replace(/\/+$/, ""));

const required = filledIn.refine(value => value.length > 0, "Required");

const envSchema = z.object({
  BARDIC_TORCH_API_BASE_URL: httpUrl,
  AUTH_SESSION_SECRET: filledIn.refine(
    value => value.length >= MIN_SECRET_LENGTH,
    `Must be at least ${MIN_SECRET_LENGTH} characters long`
  ),
  AUTH0_DOMAIN: filledIn.refine(
    value => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value),
    "Must be a host name"
  ),
  AUTH0_CLIENT_ID: required,
  AUTH0_CLIENT_SECRET: required,
  AUTH0_DEFAULT_REDIRECT_URI: httpUrl,
  AUTH0_AUDIENCE: required,
  SENTRY_DSN: z.preprocess(emptyAsMissing, z.string().url().optional()),
  AUTH_MODE: z.preprocess(
    emptyAsMissing,
    z.enum(["auth0", "stub"]).default("auth0")
  ),
});

/** Names of every variable the app reads. */
export const ENV_NAMES = envSchema.keyof().options;

export type AppEnv = Readonly<z.output<typeof envSchema>>;

type EnvResult =
  | { readonly ok: true; readonly env: AppEnv }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Validate raw bindings. Problems name the variable, never its value. */
export function parseEnv(raw: unknown): EnvResult {
  const result = envSchema.safeParse(raw);
  if (result.success) return { ok: true, env: Object.freeze(result.data) };
  return {
    ok: false,
    problems: result.error.issues.map(
      issue => `${issue.path.join(".") || "environment"}: ${issue.message}`
    ),
  };
}

/** The page served when the environment is invalid. */
export function configurationErrorResponse(
  problems: readonly string[]
): Response {
  console.error(`Invalid environment:\n${problems.join("\n")}`);
  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      "<title>Site configuration error · Bardic Torch</title></head><body>" +
      "<main><h1>Site configuration error</h1>" +
      "<p>Bardic Torch is misconfigured and cannot serve pages right now. " +
      "Please try again later.</p></main></body></html>",
    {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
