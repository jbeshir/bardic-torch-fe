import { vi } from "vitest";
import { testEnv } from "./context";

/**
 * A fake Auth0 for auth tests: its endpoints, and ID tokens as Auth0 issues
 * them. Each test run generates its own RSA key; the ID tokens are real
 * RS256 JWTs signed with it.
 * Production fetches no JWKS: an ID token from the token endpoint is checked
 * for its claims and algorithm, not its signature.
 */

const env = testEnv();
const ISSUER = `https://${env.AUTH0_DOMAIN}/`;

export const AUTH0_TOKEN_ENDPOINT = `${ISSUER}oauth/token`;
export const AUTH0_REVOKE_ENDPOINT = `${ISSUER}oauth/revoke`;

const KEY_ID = "test";
const ID_TOKEN_LIFETIME_SECONDS = 10 * 60;

const RS256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
const HS256 = { name: "HMAC", hash: "SHA-256" } as const;

const signingKey = await crypto.subtle.generateKey(
  {
    ...RS256,
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  },
  true,
  ["sign", "verify"]
);

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

type IdTokenOptions = {
  readonly claims?: Readonly<Record<string, unknown>>;
  /**
   * RS256 (Auth0's) by default. HS256 signs with the client secret, as an
   * attacker who knows it could.
   */
  readonly algorithm?: "RS256" | "HS256";
};

/**
 * An ID token as Auth0 issues it to this client: issuer, audience, subject,
 * issued now and valid for ten minutes, with `claims` laid over those.
 */
export async function idToken({
  claims = {},
  algorithm = "RS256",
}: IdTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: algorithm, typ: "JWT", kid: KEY_ID });
  const payload = encodeJson({
    iss: ISSUER,
    aud: env.AUTH0_CLIENT_ID,
    sub: "google-oauth2|1",
    iat: now,
    exp: now + ID_TOKEN_LIFETIME_SECONDS,
    ...claims,
  });
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature =
    algorithm === "RS256"
      ? await crypto.subtle.sign(RS256, signingKey.privateKey, signingInput)
      : await crypto.subtle.sign(
          HS256,
          await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(env.AUTH0_CLIENT_SECRET),
            HS256,
            false,
            ["sign"]
          ),
          signingInput
        );
  return `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
}

/**
 * Auth0 stops answering: every `fetch` hangs until its signal aborts, and
 * AUTH0_TIMEOUT_MS is shortened to 20 ms so the test needn't wait 5 s (the
 * value itself is asserted by the "bounds …" tests). Returns the stubbed
 * fetch, to check the request was made; `vi.unstubAllGlobals()` restores it.
 *
 * A stubbed fetch, not msw: on Node 22, the request after one that msw's
 * socket-level interceptor saw aborted can bypass msw for the real network.
 */
export function hangingAuth0() {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
  const hang = vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason)
        );
      })
  );
  vi.stubGlobal("fetch", hang);
  return hang;
}
