# Deploying

This runbook covers four pieces:

- the two Cloudflare Workers behind https://bardictorch.org (and https://www.bardictorch.org) and https://preview.bardictorch.org;
- their DNS;
- the API's DNS at https://api.bardictorch.org;
- the Auth0, Turnstile and Sentry set-up the frontend relies on.

The dashboard steps are done by a maintainer with access to the Cloudflare account, the GitHub repository and the Auth0 tenant. Nothing here needs a secret committed to the repository.

Names used below:

| thing             | value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| production Worker | `bardic-torch-fe` (the top-level `name` in `wrangler.jsonc`), built from `main`     |
| preview Worker    | `bardic-torch-fe-preview` (`env.preview` in `wrangler.jsonc`), built from `preview` |
| site              | `https://bardictorch.org` (`www` redirects to it)                                   |
| preview site      | `https://preview.bardictorch.org`                                                   |
| API               | `https://api.bardictorch.org` (dokku)                                               |

The site moves here from a Cloudflare Pages project (FE1). Moving the custom domains off that project is a one-off migration with its own runbook, which comes in a later stage; §3 notes what it involves.

## 1. Before the first deploy

1. **Set the two Auth0 values in `wrangler.jsonc`.** First create the Auth0 application and API (§4). Then replace `AUTH0_DOMAIN` and the placeholder `AUTH0_CLIENT_ID`, in both the top-level `vars` (production) and `env.preview.vars`, with the tenant domain and the application's client ID. Both are public values, so they belong in the repository. Commit and push. Until the placeholder is replaced, a deploy serves only the "Site configuration error" page (§2), not a site whose sign-in fails at Auth0.
2. **Protect `main`.** In GitHub → Settings → Branches, add a branch protection rule (or ruleset) for `main`:
   - require a pull request;
   - require the status checks **`validate`** and **`e2e`** (the two jobs in `.github/workflows/ci.yml`) to pass.

   Add a rule for `preview` too that restricts who can push to it: a push to `preview` deploys with the preview Worker's secrets (§2).

   CI needs no secrets.

3. **Give both Workers their secrets** before connecting Workers Builds (§2, "Bootstrap").

## 2. Cloudflare Workers

There are two Workers, both described by `wrangler.jsonc`: the production Worker `bardic-torch-fe` at the top level, and the preview Worker `bardic-torch-fe-preview` in `env.preview` (environments don't inherit, so each block is complete). Both have `workers_dev: false` and `preview_urls: false`, so neither serves a `*.workers.dev` URL or a version URL: only their custom domains (§3).

### Bootstrap: secrets before the first build

`wrangler.jsonc` lists `AUTH_SESSION_SECRET` and `AUTH0_CLIENT_SECRET` under `secrets.required`, so a deploy of a Worker that lacks either fails. Workers Builds' first deploy of a new Worker would fail too. So set them first, from a checkout, logged in with `npx wrangler login`:

```sh
npx wrangler secret put AUTH_SESSION_SECRET --name bardic-torch-fe
npx wrangler secret put AUTH0_CLIENT_SECRET --name bardic-torch-fe
npx wrangler secret put AUTH_SESSION_SECRET --name bardic-torch-fe-preview
npx wrangler secret put AUTH0_CLIENT_SECRET --name bardic-torch-fe-preview
# Optional (§6), for either or both:
npx wrangler secret put SENTRY_DSN --name bardic-torch-fe
```

`wrangler secret put` on a Worker that doesn't exist yet creates it as a draft Worker that holds only the secret, which the first deploy then fills in. If that doesn't work for an account, deploy once from a local build instead: build the mode (`npm run build`, or `npm run build:preview` for the preview Worker), write the secrets to a temporary file in `KEY=value` lines with `umask 077`, run `npx wrangler deploy --secrets-file <that file>`, and delete the file straight away.

Later, change a secret with `npx wrangler secret put NAME` (production) or `npx wrangler secret put NAME --env preview` (preview), from a checkout, or in the dashboard (the Worker → Settings → Variables and Secrets).

### Workers Builds

Connect each Worker to the GitHub repository: Workers & Pages → the Worker → Settings → Builds → **Connect**. Fill in, for each:

| setting                            | production Worker     | preview Worker            |
| ---------------------------------- | --------------------- | ------------------------- |
| Worker                             | `bardic-torch-fe`     | `bardic-torch-fe-preview` |
| build command                      | `npm run build:ci`    | `npm run build:ci`        |
| deploy command                     | `npx wrangler deploy` | `npx wrangler deploy`     |
| root directory                     | `/`                   | `/`                       |
| production branch                  | `main`                | `preview`                 |
| builds for non-production branches | **off**               | **off**                   |

So the production Worker has **Production branch:** `main`; **builds for non-production branches:** off. The preview Worker has **Production branch:** `preview`; **builds for non-production branches:** off.

**Node and npm.** The build image takes Node from `.nvmrc` (26.13.0) and npm from `package.json`'s `packageManager`. Check that each Worker's first build log shows Node v26.13.0; if it doesn't, add the build variable `NODE_VERSION=26.13.0` (Settings → Builds → Variables).

`npm run build:ci` (`node scripts/build.mjs --from-branch`) reads the `WORKERS_CI_BRANCH` variable that Workers Builds sets:

- `main` → the **production** build for `bardic-torch-fe`: no styleguide, no stub sign-in.
- `preview` → the **preview** build for `bardic-torch-fe-preview` (it sets `CLOUDFLARE_ENV=preview`, so the built config names the preview Worker): includes `/styleguide`, still no stub sign-in.
- Empty or unset → the build **fails** ("WORKERS_CI_BRANCH is empty: refusing to guess a deploy target"): the mode decides which Worker is deployed, so it never guesses.
- Any other branch → the build **fails** ("Branch … is not deployed"). This catches non-production builds turned on by mistake.

It then checks that the built config (`build/server/wrangler.json`, which `npx wrangler deploy` deploys) names the mode's Worker, and, when Workers Builds names the connection's Worker (`WORKERS_CI_WORKER_NAME`), that it is that one, so the preview connection can't deploy a production build or the reverse. It deletes the `build/server/.dev.vars` the Cloudflare Vite plugin writes, so no local value ends up in a build.

**Why only `preview`.** A preview build runs with the preview Worker's secrets, and Workers Builds builds a branch whether or not CI passed. The preview Worker shares the production Auth0 application (its client secret) and the production API (§4). If every branch were built, anyone who can push a branch could deploy unreviewed code that reads the client secret or uses real tokens against `api.bardictorch.org`. With one preview branch, the trade-off is:

- only people who may push to `preview` can run code with those secrets, so protect `preview` like `main` in GitHub (restrict who can push to it);
- feature branches get no deployment of their own. Push a branch to `preview` to try it (§7), or run it locally (README).

Workers' own previews (non-production branch builds and version preview URLs) aren't used for the same reason: every branch would get a URL running with the Worker's secrets, and the URLs vary, so Auth0's callback and logout lists couldn't name them exactly. Cloudflare's own guidance is "Do not use Version URLs for branch or pull request testing".

A separate Auth0 application for previews would remove the shared client secret too. It isn't used: previews would then sign in against a different set of Auth0 users from production.

**Runtime.** `wrangler.jsonc` sets the compatibility date (`2026-11-01`, the bundled workerd's: a hygiene test ties them, so bump it with wrangler) and the `nodejs_compat` flag (`@sentry/cloudflare` needs it, §6), for both Workers. Change these in `wrangler.jsonc` only. `observability.enabled` turns on Workers Logs, and `upload_source_maps` uploads the Worker's source maps with each deploy.

**What runs where.** The Worker is `workers/app.ts` (Sentry's `withSentry`, §6, around `app/server/worker.server.ts`). For every request it validates the environment, gives React Router the request's context (the validated environment and a per-request auth cache, `app/server/context.server.ts`), and adds the security headers to any response without a CSP. Before React Router runs, it answers an `/assets/*` file that doesn't exist with a plain 404 (`no-store`), never a rendered page, and a cross-origin POST, PUT, PATCH or DELETE to a page or `.data` URL with 400 "Bad Request" (`no-store`): React Router refuses those itself, but would report them to Sentry. The resource routes (`/api/*`, `/auth/*`, `/resources/theme`) keep their own same-origin check, a 403. The static files (`build/client`: `/assets/*`, `/favicon.svg`, `/site.webmanifest`) are Workers static assets, wired up by `@cloudflare/vite-plugin`: they are served without running the Worker. `public/_headers` gives `/assets/*` a one-year immutable cache. Everything else (security headers and the nonce CSP on every response the Worker makes, resource routes and redirects included, `Cache-Control: private, no-cache` on documents, `no-store` on `/settings` and its data, signed-in root data, the auth routes and the proxies) is set per request by the app.

### Environment variables

**`wrangler.jsonc` is the source of truth for plain-text variables**, per Worker (`vars`). The dashboard can't edit them while it exists, and a deploy replaces them. Change them with a commit.

**Secrets** are set with `npx wrangler secret put` (see "Bootstrap" above) or in the dashboard, once per Worker. They are never committed.

| variable                     | kind                    | production                      | preview                           |
| ---------------------------- | ----------------------- | ------------------------------- | --------------------------------- |
| `BARDIC_TORCH_API_BASE_URL`  | plain, `wrangler.jsonc` | `https://api.bardictorch.org`   | `https://api.bardictorch.org`     |
| `AUTH0_DOMAIN`               | plain, `wrangler.jsonc` | the tenant domain               | the same                          |
| `AUTH0_CLIENT_ID`            | plain, `wrangler.jsonc` | the application's client ID     | the same                          |
| `AUTH0_DEFAULT_REDIRECT_URI` | plain, `wrangler.jsonc` | `https://bardictorch.org`       | `https://preview.bardictorch.org` |
| `AUTH0_AUDIENCE`             | plain, `wrangler.jsonc` | `https://api.bardictorch.org`   | the same                          |
| `AUTH_SESSION_SECRET`        | **secret**, required    | random, at least 32 characters  | a **different** random value      |
| `AUTH0_CLIENT_SECRET`        | **secret**, required    | the application's client secret | the same                          |
| `SENTRY_DSN`                 | **secret**, optional    | the Sentry DSN, or unset        | the same, or unset                |
| `AUTH_MODE`                  | never set               | —                               | —                                 |

Notes on the variables:

- **`AUTH0_DEFAULT_REDIRECT_URI`** is the site's origin, with no path and no trailing slash. Sign-in comes back to `<it>/auth/callback`.
- **`AUTH_SESSION_SECRET`** signs the `__Host-bt_session` and `__Host-bt_return_to` cookies. Generate it with `openssl rand -base64 48`. Using a different value in preview means a preview session can never be replayed on production. Changing it signs everyone out.
- **`SENTRY_DSN`** is not sensitive (the browser receives it too), but it is kept out of the repository as a secret. Without it, nothing is sent to Sentry.
- **`AUTH_MODE`** must never be set. Production and preview builds don't contain stub sign-in, and they ignore `AUTH_MODE=stub` with a logged error.

Every request validates these variables (`app/server/env.server.ts`). If one is missing or malformed, or is still a placeholder starting `replace-with` (as `AUTH0_CLIENT_ID` is in `wrangler.jsonc` until step 1 of §1 is done), every page is a plain **"Site configuration error"** page with status 500. The variable's name, never its value, is logged ("Invalid environment: …"), and shows in Workers Logs (the Worker → Observability → Logs).

A plain-text variable changes with the next deploy of the commit that changes it. A secret set with `wrangler secret put` deploys a new version of the Worker straight away.

## 3. DNS and custom domains

The `bardictorch.org` zone is on Cloudflare: the registrar's nameservers point at the zone's assigned Cloudflare nameservers.

### The site: `bardictorch.org`, `www` and `preview`

1. **Custom domains come from `wrangler.jsonc`.** Each Worker's `routes` lists its custom domains: `bardictorch.org` and `www.bardictorch.org` for `bardic-torch-fe`, `preview.bardictorch.org` for `bardic-torch-fe-preview`. On deploy, Cloudflare creates each hostname's DNS record and edge certificate itself, but only if the hostname has no DNS record yet. Don't create these records by hand.

   The hostnames that the FE1 Pages project serves (`bardictorch.org` and `www`) already have records, pointing at Pages, so they must be removed from the Pages project and their records deleted before the Workers can take them. That is a one-off migration; a later stage writes its full runbook. Until then, only `preview.bardictorch.org` is new.

2. **TLS.** Cloudflare issues and renews an edge certificate for each custom domain; wait until they show **Active** (the Worker → Settings → Domains & Routes). Then, in the zone's SSL/TLS settings:
   - encryption mode **Full (strict)**;
   - **Always Use HTTPS** on;
   - minimum TLS version 1.2.

   The app's cookies are all `Secure`, so the site is HTTPS-only by design. Turn on HSTS only once every name serves correctly.

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
3. **Check it.** `curl https://api.bardictorch.org/healthz` returns 200 `{"status":"ok"}` (the process is up), and `curl https://api.bardictorch.org/readyz` returns the same once the database answers (503 `unavailable` if it doesn't).

**No CORS set-up is needed.** The browser never calls the API. Loaders and the `/api/*` proxy routes call it from the Worker, server to server, with the user's bearer token.

## 4. Auth0

Create one **Regular Web Application** (Applications → Create Application → Regular Web Applications). The server keeps the client secret and does the code exchange. The production and preview Workers share the application, which is why only the `preview` branch gets a preview build (§2).

**Application settings:**

| setting                             | value                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Application Login URI               | `https://bardictorch.org/auth/login`                                                                                                       |
| Allowed Callback URLs               | `https://bardictorch.org/auth/callback`, `https://preview.bardictorch.org/auth/callback`                                                   |
| Allowed Logout URLs                 | `https://bardictorch.org`, `https://preview.bardictorch.org`                                                                               |
| Allowed Web Origins                 | `https://bardictorch.org`, `https://preview.bardictorch.org` (the app makes no browser-side Auth0 calls, so this is only for completeness) |
| Credentials → Authentication Method | **Client Secret (Basic)**: the strategy (remix-auth-auth0 2 on arctic) sends the client credentials in an HTTP Basic header                |
| Advanced → Grant Types              | Authorization Code, Refresh Token                                                                                                          |

How these URLs are used:

- **Callback URLs.** `/auth/login` sends Auth0 `redirect_uri = AUTH0_DEFAULT_REDIRECT_URI + "/auth/callback"`, so each Worker's value must be listed.
- **Logout URLs.** `POST /auth/logout` clears the session and redirects to `https://<AUTH0_DOMAIN>/v2/logout?client_id=…&returnTo=<the request's origin>`, so each origin must be listed. CSP `form-action` already allows the Auth0 domain.
- **Preview.** Sign-in and log-out work on `https://preview.bardictorch.org`, the preview Worker's only URL: there are no version or `workers.dev` URLs (§2).
- **Local development.** Don't add `localhost` URLs to this application. For `npm run dev` against a real tenant, create a second Regular Web Application (e.g. "Bardic Torch (development)") with Allowed Callback URLs `http://localhost:5173/auth/callback`, Allowed Logout URLs `http://localhost:5173`, the same API and connections, and put its client ID and secret in `.dev.vars` (README).

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

- Enable **Google** (`google-oauth2`) and **Facebook** (`facebook`) with the project's own OAuth credentials, not Auth0's development keys (set up as below). Turn both on for this application under its Connections tab.
- Turn the username-password database connection **off** for the application. The site only offers social sign-in.
- The backend sees user IDs such as `google-oauth2|<id>`.

The identity providers send the reader back to **Auth0**, not to the site, so their redirect URI is always `https://<AUTH0_DOMAIN>/login/callback`.

**Google** (Google Cloud console, a project for Bardic Torch):

1. APIs & Services → OAuth consent screen: user type **External**, app name "Bardic Torch", support email, authorised domain `bardictorch.org` (and the Auth0 domain's, if it is a custom domain), scopes `email` and `profile` (and `openid`).
2. Credentials → Create credentials → OAuth client ID: type **Web application**, Authorised redirect URI `https://<AUTH0_DOMAIN>/login/callback`.
3. Publish the consent screen (**In production**). While it is in Testing, only listed test users can sign in.
4. In Auth0's Google connection, enter the client ID and client secret, with the attributes `email` and `profile`.

**Facebook** (Meta for Developers, an app of type Consumer, with the Facebook Login product):

1. Facebook Login → Settings: **Valid OAuth Redirect URIs** `https://<AUTH0_DOMAIN>/login/callback`.
2. App settings → Basic: app domain, a **Privacy Policy URL** and a **User Data Deletion** URL (instructions URL). Until FE4 adds the privacy and contact/opt-out pages, point both at a help page that explains how to ask (e.g. `https://bardictorch.org/help/faq-for-bards`, which covers opting out and how to contact us).
3. Permissions: `email` and `public_profile`.
4. Switch the app to **Live**. In Development mode, only the app's admins, developers and testers can sign in.
5. In Auth0's Facebook connection, enter the App ID and App Secret, with the `email` permission.

If §8's browser check 1 fails at the provider, the usual causes are a redirect URI that isn't exactly `https://<AUTH0_DOMAIN>/login/callback` (Google: `redirect_uri_mismatch`), a consent screen still in Testing, or a Facebook app still in Development mode.

## 5. Turnstile (for FE4; not used by FE1)

FE4's contact, takedown and opt-out form will be protected by Cloudflare Turnstile. The API verifies the token (`POST /v1/contact`). Create the widget now so FE4 only has to wire it in:

1. Go to Cloudflare dashboard → Turnstile → Add widget.
   - **Name:** "Bardic Torch contact form".
   - **Hostnames:** `bardictorch.org` and `preview.bardictorch.org`.
   - **Widget mode:** Managed.
2. **Site key.** It is public. FE4 will add it to `wrangler.jsonc` as a plain-text variable per Worker, and allow `https://challenges.cloudflare.com` in the CSP.
3. **Secret key.** It goes to the **API**, not the frontend: set it in the API's dokku config with `dokku config:set <api-app> …`, under the name the backend defines. It is never a Worker variable.
4. **Local development and e2e** use Cloudflare's published test keys, not the real ones.

Nothing in FE1 reads either key.

## 6. Sentry (optional)

- **Setting it up.** Create a project for the browser and Workers (JavaScript → React Router or Cloudflare), then set its DSN as the `SENTRY_DSN` secret of the production and/or preview Worker (`npx wrangler secret put SENTRY_DSN`, with `--env preview` for the preview Worker), which deploys it. With a DSN set:
  - the browser reports errors (`@sentry/react`, started by `SentryProvider` in the root `Layout`, and by an error page that is the first thing rendered), and traces page loads and navigations, with spans named by URL path (Sentry's React Router integration can only name them by route for a router it creates, and React Router's `HydratedRouter` creates its own);
  - the server reports errors with `@sentry/cloudflare`: `withSentry` in `workers/app.ts` gives every request its own Sentry scope and reports what the Worker throws, and `entry.server.tsx` reports what React Router catches: loader and action errors (`handleError`, except abandoned requests) and render errors;
  - the CSP's `connect-src` gains the DSN's ingest origin;
  - error pages show the Sentry event ID as an error reference.
- **Privacy.** Both SDKs collect nothing about the reader or the request: `dataCollection` (`app/constants/sentry.ts`, shared by both runtimes) turns off user information and the IP address, cookies, headers, request and response bodies and query strings. On the server, `beforeSend` and `beforeSendSpan` (`app/server/sentry.server.ts`) also strip the query string from events and spans (`/auth/callback?code=…&state=…` carries one-time secrets), and `beforeSendSpan` drops the User-Agent, which the SDK records on spans whatever `dataCollection` says.
- **Runtime flag.** `@sentry/cloudflare` 11 needs the `nodejs_compat` compatibility flag, which `wrangler.jsonc` sets for both Workers.
- **Always:** every server error is also `console.error`'d, so it shows in Workers Logs (the Worker → Observability → Logs) with or without Sentry.
- **Without it,** nothing is initialised, nothing is sent and no reference is shown.

## 7. Deploying

- **Production:** merge to `main`. The required checks run on the pull request; Workers Builds builds `main` in production mode and deploys it to `bardic-torch-fe`, served on `bardictorch.org`.
- **Preview:** push to `preview`, e.g. `git push origin HEAD:preview`. Workers Builds builds it in preview mode, with `/styleguide`, and deploys it to `bardic-torch-fe-preview`, served on `https://preview.bardictorch.org`. Sign-in works there against the same Auth0 application and API.
- **Other branches** are not deployed (§2). CI still runs on their pull requests.

Until production is signed off, deploy to the preview Worker only.

## 8. Post-deploy smoke checks

Run these against the deployed origin. `SITE=https://bardictorch.org`, or `https://preview.bardictorch.org`.

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
#      set-cookie: __Host-bt_auth0:<state id>=…; set-cookie: __Host-bt_return_to=…

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

# 8. The API is up, and so is its database.
curl -s https://api.bardictorch.org/healthz                      # {"status":"ok"}
curl -s https://api.bardictorch.org/readyz                       # {"status":"ok"}
```

Then, in a browser:

1. **Sign in with Google**, then with Facebook. Each comes back to the page you started on, and the account menu shows your display name. If it says "We couldn't load your profile", the API or the audience is wrong.
2. **`/settings`:** rename yourself (a toast confirms it), create an API token (its secret is shown once, and can be copied), then revoke it after confirming.
3. **Log out.** You pass through Auth0 and come back signed out. An Auth0 "invalid returnTo" error means §4's logout URLs are wrong.
4. **Switch the theme** to dark, reload, and it stays dark, with no flash.
5. **The console** shows no CSP violations.

## 9. Rollback

- **Fastest:** the Worker → Deployments → find the last good version → **Rollback**, or `npx wrangler rollback` (with `--name bardic-torch-fe-preview` for the preview Worker). It is live within seconds. Use it for a bad commit, not for a bad variable.
- **Then fix forward:** revert the bad commit on `main` (`git revert <sha>`, via a pull request so the checks run). The next build replaces the rollback.
- **A bad variable or secret:** don't roll back. Correct the value (a commit for `wrangler.jsonc` variables, which the next deploy applies; `npx wrangler secret put` for secrets, which deploys at once).
- **An API change that breaks the frontend:** roll back the frontend as above. Afterwards, `npm run sync:api -- <the backend's openapi/api.yaml>`, fix what `validate` reports, and redeploy.
- **Auth0 or DNS changes** are not versioned with the site. Undo them in their dashboards: §3 and §4 list every value.
