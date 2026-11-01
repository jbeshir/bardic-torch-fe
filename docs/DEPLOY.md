# Deploying

This runbook covers four pieces:

- the Cloudflare Pages project behind https://bardictorch.org and https://www.bardictorch.org;
- its DNS;
- the API's DNS at https://api.bardictorch.org;
- the Auth0, Turnstile and Sentry set-up the frontend relies on.

The dashboard steps are done by a maintainer with access to the Cloudflare account, the GitHub repository and the Auth0 tenant. Nothing here needs a secret committed to the repository.

Names used below:

| thing                | value                                                   |
| -------------------- | ------------------------------------------------------- |
| Pages project        | `bardic-torch-fe` (the `name` in `wrangler.toml`)       |
| production branch    | `main`                                                  |
| preview branch alias | `preview` → `https://preview.bardic-torch-fe.pages.dev` |
| site                 | `https://bardictorch.org` (`www` redirects to it)       |
| API                  | `https://api.bardictorch.org` (dokku)                   |

## 1. Before the first deploy

1. **Set the two Auth0 values in `wrangler.toml`.** Replace `AUTH0_DOMAIN` and the placeholder `AUTH0_CLIENT_ID`, in both `[env.preview.vars]` and `[env.production.vars]`, with the real tenant domain and client ID (from §4). Both are public values, so they belong in the repository. Commit and push.
2. **Protect `main`.** In GitHub → Settings → Branches, add a branch protection rule (or ruleset) for `main`:
   - require a pull request;
   - require the status checks **`validate`** and **`e2e`** (the two jobs in `.github/workflows/ci.yml`) to pass.

   CI needs no secrets.

## 2. Cloudflare Pages project

Go to Workers & Pages → Create → Pages → **Connect to Git**, choose the GitHub repository, and fill in:

| setting                | value                                                   |
| ---------------------- | ------------------------------------------------------- |
| project name           | `bardic-torch-fe`                                       |
| production branch      | `main`                                                  |
| framework preset       | None                                                    |
| build command          | `npm run build:pages`                                   |
| build output directory | `build/client`                                          |
| root directory         | `/` (empty)                                             |
| Node version           | from `.nvmrc` (`22`), which the Pages build image reads |

Then set the branch controls under Settings → Builds & deployments → Branch control:

- **Production branch:** `main`.
- **Preview branches:** all non-production branches. That includes `preview`, whose alias is the one Auth0 knows (§4).

`npm run build:pages` (`scripts/build-pages.mjs`) reads the `CF_PAGES_BRANCH` variable that Pages sets:

- `main`, or no branch at all → the **production** build: no styleguide, no stub sign-in.
- Any other branch → the **preview** build: includes `/styleguide`, still no stub sign-in.

The Pages Function is `functions/[[path]].ts`. `public/_routes.json` keeps `/assets/*`, `/favicon.svg` and `/site.webmanifest` away from it, so static files never cost a Function invocation. `public/_headers` gives `/assets/*` a one-year immutable cache. Everything else (security headers, the nonce CSP, `Cache-Control: private, no-cache` on documents, `no-store` on `/settings`, the auth routes and the proxies) is set per request by the app.

### Environment variables

Because the repository has a `wrangler.toml` with `pages_build_output_dir`, **`wrangler.toml` is the source of truth for plain-text variables**, per environment. The dashboard shows them read-only. Change them with a commit.

**Secrets** are set in the dashboard: Settings → Variables and Secrets → Add → type **Secret**, once for **Production** and once for **Preview**.

| variable                     | kind                   | production                      | preview                                     |
| ---------------------------- | ---------------------- | ------------------------------- | ------------------------------------------- |
| `BARDIC_TORCH_API_BASE_URL`  | plain, `wrangler.toml` | `https://api.bardictorch.org`   | `https://api.bardictorch.org`               |
| `AUTH0_DOMAIN`               | plain, `wrangler.toml` | the tenant domain               | the same                                    |
| `AUTH0_CLIENT_ID`            | plain, `wrangler.toml` | the application's client ID     | the same                                    |
| `AUTH0_DEFAULT_REDIRECT_URI` | plain, `wrangler.toml` | `https://bardictorch.org`       | `https://preview.bardic-torch-fe.pages.dev` |
| `AUTH0_AUDIENCE`             | plain, `wrangler.toml` | `https://api.bardictorch.org`   | the same                                    |
| `AUTH_SESSION_SECRET`        | **secret**             | random, at least 32 characters  | a **different** random value                |
| `AUTH0_CLIENT_SECRET`        | **secret**             | the application's client secret | the same                                    |
| `SENTRY_DSN`                 | **secret**, optional   | the Sentry DSN, or unset        | the same, or unset                          |
| `AUTH_MODE`                  | never set              | —                               | —                                           |

Notes on the variables:

- **`AUTH0_DEFAULT_REDIRECT_URI`** is the site's origin, with no path and no trailing slash. Sign-in comes back to `<it>/auth/callback`.
- **`AUTH_SESSION_SECRET`** signs the `__Host-bt_session` and `__Host-bt_return_to` cookies. Generate it with `openssl rand -base64 48`. Using a different value in preview means a preview session can never be replayed on production. Changing it signs everyone out.
- **`SENTRY_DSN`** is not sensitive (the browser receives it too), but it is kept out of the repository as a secret. Without it, nothing is sent to Sentry.
- **`AUTH_MODE`** must never be set. Production and preview builds don't contain stub sign-in, and they ignore `AUTH_MODE=stub` with a logged error.

Every request validates these variables (`app/server/env.server.ts`). If one is missing or malformed, every page is a plain **"Site configuration error"** page with status 500. The variable's name, never its value, is logged ("Invalid environment: …"), and shows in the Function's real-time logs (Deployments → the deployment → Functions → Real-time logs).

Variable changes apply only to **new** deployments. Retry the latest deployment after changing one.

## 3. DNS and custom domains

The `bardictorch.org` zone is on Cloudflare: the registrar's nameservers point at the zone's assigned Cloudflare nameservers.

### The site: `bardictorch.org` and `www`

1. **Add both custom domains.** In the Pages project → Custom domains → Set up a custom domain, add `bardictorch.org`, then `www.bardictorch.org`. Because the zone is on Cloudflare, Pages creates the records itself, both **proxied** (orange cloud):
   - `bardictorch.org` → `CNAME bardic-torch-fe.pages.dev`. At the apex this works by Cloudflare's CNAME flattening.
   - `www` → `CNAME bardic-torch-fe.pages.dev`.

   Don't create these records by hand first. If one already exists, Pages asks to replace it.

2. **TLS.** Pages issues and renews an edge certificate for each custom domain; wait until both show **Active**. Then, in the zone's SSL/TLS settings:
   - encryption mode **Full (strict)**;
   - **Always Use HTTPS** on;
   - minimum TLS version 1.2.

   The app's cookies are all `Secure`, so the site is HTTPS-only by design. Turn on HSTS only once both names serve correctly.

3. **Redirect `www` to the apex.** The session, returnTo and Auth0 state cookies are `__Host-` cookies, which belong to one host. `AUTH0_DEFAULT_REDIRECT_URI` is the apex. So a sign-in started on `www` would lose its state cookie on the way back. Make `www` a permanent redirect: Rules → Redirect Rules → Create rule:
   - **When:** hostname equals `www.bardictorch.org`.
   - **Then:** dynamic redirect to the expression `concat("https://bardictorch.org", http.request.uri.path)`, status **301**, **preserve query string** on.

   The `www` record must stay proxied for the rule to run.

### The API: `api.bardictorch.org` on dokku

The API is a separate repository, deployed to the maintainer's dokku host. The frontend only needs the name to resolve and to serve a valid certificate.

1. **DNS records.** In the zone, add:
   - `A api → <dokku host IPv4>`;
   - `AAAA api → <dokku host IPv6>`, if the host has IPv6.

   Set both to **DNS only (grey cloud)**. dokku's letsencrypt plugin answers the HTTP-01 challenge and terminates TLS itself. A proxied record would put Cloudflare's certificate in front and break issuance and renewal.

2. **On the dokku host**, for the API's app:
   - `dokku domains:set <api-app> api.bardictorch.org`
   - `dokku letsencrypt:set <api-app> email <maintainer address>`
   - `dokku letsencrypt:enable <api-app>`
   - `dokku letsencrypt:cron-job --add` (renewal)
3. **Check it.** `curl https://api.bardictorch.org/healthz` returns 200 `{"status":"ok"}`.

**No CORS set-up is needed.** The browser never calls the API. Loaders and the `/api/*` proxy routes call it from the Pages Function, server to server, with the user's bearer token.

## 4. Auth0

Create one **Regular Web Application** (Applications → Create Application → Regular Web Applications). The server keeps the client secret and does the code exchange. Production and the preview alias share the application.

**Application settings:**

| setting                             | value                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application Login URI               | `https://bardictorch.org/auth/login`                                                                                                                 |
| Allowed Callback URLs               | `https://bardictorch.org/auth/callback`, `https://preview.bardic-torch-fe.pages.dev/auth/callback`                                                   |
| Allowed Logout URLs                 | `https://bardictorch.org`, `https://preview.bardic-torch-fe.pages.dev`                                                                               |
| Allowed Web Origins                 | `https://bardictorch.org`, `https://preview.bardic-torch-fe.pages.dev` (the app makes no browser-side Auth0 calls, so this is only for completeness) |
| Credentials → Authentication Method | **Client Secret (Basic)**: the strategy (remix-auth-auth0 2 on arctic) sends the client credentials in an HTTP Basic header                          |
| Advanced → Grant Types              | Authorization Code, Refresh Token                                                                                                                    |

How these URLs are used:

- **Callback URLs.** `/auth/login` sends Auth0 `redirect_uri = AUTH0_DEFAULT_REDIRECT_URI + "/auth/callback"`, so each environment's value must be listed.
- **Logout URLs.** `POST /auth/logout` clears the session and redirects to `https://<AUTH0_DOMAIN>/v2/logout?client_id=…&returnTo=<the request's origin>`, so each origin must be listed. CSP `form-action` already allows the Auth0 domain.
- **Preview deployments.** Sign-in and log-out work only on the `preview` alias. Other preview URLs (per-commit hashes, other branch aliases) can be browsed, but sign-in returns to the alias, where their host-only state cookie doesn't exist.

**API** (Applications → APIs → Create API):

- **Identifier (audience):** `https://api.bardictorch.org`. This is `AUTH0_AUDIENCE`, and must be what the backend expects as its audience. Signing algorithm RS256.
- **Allow Offline Access: on.** The app asks for `openid offline_access` (`app/server/auth.server.ts`); it reads no profile claims and stores only the tokens. Without offline access, Auth0 issues no refresh token: sign-in still works, but the reader is signed out when the access token expires instead of it being refreshed.
- **Access token lifetime:** the app refreshes the token 5 minutes before it expires, so any lifetime well above that works (the default is 24 hours). The session cookie itself lasts 7 days.

**Refresh tokens** (in the application's settings):

- **Rotation** can be on or off. The app stores the new refresh token whenever Auth0 returns one, and keeps the old one when Auth0 doesn't rotate it. A response without `expires_in` gets a 24-hour lifetime.
- **Failures.** Only a refused refresh token (Auth0 answers `invalid_grant` or another 4xx) ends the session. When Auth0 is down, slow or answers 5xx, the session is kept: the current access token is used while it is still valid, and once it has expired that request is treated as signed out and the next one retries. Every Auth0 call (code exchange, refresh, revocation) gives up after 5 seconds.
- **Logout** revokes the session's refresh token at Auth0 (`/oauth/revoke`, best effort) before deleting the cookie, so a copied cookie can't be renewed.
- All the loaders of one request share a single refresh, so a single-use token is never spent twice within a request.
- Two _separate_ requests that arrive together near expiry can each try to refresh. With rotation on, give it a **reuse interval** (e.g. 60 seconds) so the second one doesn't fail and sign the reader out.
- Set the refresh token's **absolute lifetime** to at least 7 days (the session's), so sessions don't end early.

**Connections** (Authentication → Social):

- Enable **Google** (`google-oauth2`) and **Facebook** (`facebook`) with the project's own OAuth credentials, not Auth0's development keys. Turn both on for this application under its Connections tab.
- Turn the username-password database connection **off** for the application. The site only offers social sign-in.
- The backend sees user IDs such as `google-oauth2|<id>`.

## 5. Turnstile (for FE4; not used by FE1)

FE4's contact, takedown and opt-out form will be protected by Cloudflare Turnstile. The API verifies the token (`POST /v1/contact`). Create the widget now so FE4 only has to wire it in:

1. Go to Cloudflare dashboard → Turnstile → Add widget.
   - **Name:** "Bardic Torch contact form".
   - **Hostnames:** `bardictorch.org` and `preview.bardic-torch-fe.pages.dev`.
   - **Widget mode:** Managed.
2. **Site key.** It is public. FE4 will add it to `wrangler.toml` as a plain-text variable per environment, and allow `https://challenges.cloudflare.com` in the CSP.
3. **Secret key.** It goes to the **API**, not the frontend: set it in the API's dokku config with `dokku config:set <api-app> …`, under the name the backend defines. It is never a Pages variable.
4. **Local development and e2e** use Cloudflare's published test keys, not the real ones.

Nothing in FE1 reads either key.

## 6. Sentry (optional)

- **Setting it up.** Create a project for the browser and Workers (JavaScript → Remix), then set its DSN as the `SENTRY_DSN` secret for Production and/or Preview, and redeploy. With a DSN set:
  - the browser reports errors (`@sentry/remix`);
  - the server initialises Sentry in `entry.server.tsx`;
  - the CSP's `connect-src` gains the DSN's ingest origin;
  - error pages show the Sentry event ID as an error reference.
- **Without it,** nothing is initialised, nothing is sent and no reference is shown.

## 7. Deploying

- **Production:** merge to `main`. The required checks run on the pull request; Pages builds `main` in production mode and serves it on `bardictorch.org`.
- **Preview:** push to `preview`, e.g. `git push origin HEAD:preview`. It is served on `https://preview.bardic-torch-fe.pages.dev` in preview mode, with `/styleguide`. Sign-in works there against the same Auth0 application and API.
- **Other branches** also get preview builds at their own `*.bardic-torch-fe.pages.dev` URLs, without working sign-in (see §4).

Until production is signed off, deploy FE1 to the `preview` alias only.

## 8. Post-deploy smoke checks

Run these against the deployed origin. `SITE=https://bardictorch.org`, or the preview alias.

```sh
# 1. The home page renders with the app's headers.
curl -sI "$SITE/" | grep -iE '^(HTTP|content-security-policy|cache-control|vary|x-content-type-options)'
#    → 200; CSP with script-src 'nonce-…'; cache-control: private, no-cache; vary: Cookie; nosniff

# 2. Static assets are cached for a year.
curl -s "$SITE/" | grep -o '/assets/[^"]*\.css' | head -1 | xargs -I{} curl -sI "$SITE{}" | grep -i cache-control
#    → public, max-age=31536000, immutable

# 3. Sign-in goes to Auth0 with this origin's callback, and sets the state and returnTo cookies.
curl -sI "$SITE/auth/login?returnTo=/settings" | grep -iE '^(HTTP|location|set-cookie)'
#    → 302 to https://<AUTH0_DOMAIN>/authorize?…redirect_uri=<SITE>%2Fauth%2Fcallback…
#      set-cookie: __Host-bt_auth0=…; set-cookie: __Host-bt_return_to=…

# 4. Stub sign-in is absent: ?as is ignored, and it still goes to Auth0.
curl -sI "$SITE/auth/login?as=contributor" | grep -i '^location'

# 5. The styleguide: 404 on production, 200 on preview.
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/styleguide"

# 6. Unknown pages are the app's 404; help pages render.
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/no-such-page"    # 404
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/help/licence"    # 200

# 7. www redirects to the apex, keeping path and query (production only).
curl -sI "https://www.bardictorch.org/help?x=1" | grep -iE '^(HTTP|location)'
#    → 301, location: https://bardictorch.org/help?x=1

# 8. The API is up.
curl -s https://api.bardictorch.org/healthz                      # {"status":"ok"}
```

Then, in a browser:

1. **Sign in with Google**, then with Facebook. Each comes back to the page you started on, and the account menu shows your display name. If it says "We couldn't load your profile", the API or the audience is wrong.
2. **`/settings`:** rename yourself (a toast confirms it), create an API token (its secret is shown once, and can be copied), then revoke it after confirming.
3. **Log out.** You pass through Auth0 and come back signed out. An Auth0 "invalid returnTo" error means §4's logout URLs are wrong.
4. **Switch the theme** to dark, reload, and it stays dark, with no flash.
5. **The console** shows no CSP violations.

## 9. Rollback

- **Fastest:** Pages project → Deployments → find the last good **production** deployment → ⋯ → **Rollback to this deployment**. It is live within seconds, with the variables it was built with.
- **Then fix forward:** revert the bad commit on `main` (`git revert <sha>`, via a pull request so the checks run). The next build replaces the rollback.
- **A bad variable or secret:** fix it, then retry the deployment. Variables apply only to new deployments. Rolling back to an older deployment doesn't undo a secret change.
- **An API change that breaks the frontend:** roll back the frontend as above. Afterwards, `npm run sync:api -- <the backend's openapi/api.yaml>`, fix what `validate` reports, and redeploy.
- **Auth0 or DNS changes** are not versioned with the site. Undo them in their dashboards: §3 and §4 list every value.
