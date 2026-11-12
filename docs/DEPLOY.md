# Deploying

This runbook covers:

- the two Cloudflare Workers behind https://bardictorch.org and https://preview.bardictorch.org, built from GitHub by Workers Builds;
- the zone, the custom domains, TLS and the `www` redirect;
- the API's DNS at https://api.bardictorch.org;
- the Auth0, Turnstile and Sentry set-up the frontend relies on;
- the first deploy, the smoke checks and rollback.

The dashboard steps are done by a maintainer with access to the Cloudflare account, the GitHub repository and the Auth0 tenant. Nothing here needs a secret committed to the repository.

**This is a first-time set-up.** Nothing exists yet in Cloudflare for the site: no zone, no Workers, no Pages project, no DNS records for its hostnames. So there is nothing to migrate. Cloudflare's own advice for a new site is _"Start new projects with Workers"_ (https://developers.cloudflare.com/pages/), and React Router's Cloudflare guide is Workers-only. If a Pages project or a hand-made DNS record for one of the site's hostnames does exist by the time you do this, remove it first: a custom domain can't be created on a hostname that already has a record (§3).

Names used below:

| thing             | value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| production Worker | `bardic-torch-fe` (the top-level `name` in `wrangler.jsonc`), built from `main`     |
| preview Worker    | `bardic-torch-fe-preview` (`env.preview` in `wrangler.jsonc`), built from `preview` |
| site              | `https://bardictorch.org` (`www` redirects to it)                                   |
| preview site      | `https://preview.bardictorch.org`                                                   |
| API               | `https://api.bardictorch.org` (dokku)                                               |

## 1. Before the first deploy

Do these once, in this order. Each step links to the section with the details.

1. **Create the Auth0 application and API** (§4). Then **set the two Auth0 values in `wrangler.jsonc`**: replace `AUTH0_DOMAIN` and the placeholder `AUTH0_CLIENT_ID`, in both the top-level `vars` (production) and `env.preview.vars`, with the tenant domain and the application's client ID. Both are public values, so they belong in the repository. Open a pull request with them, and leave it open for step 2. Until the placeholder is replaced, a deploy serves only the "Site configuration error" page (§2), not a site whose sign-in fails at Auth0.
2. **Protect `main`.** Wait until step 1's pull request has run its checks: GitHub only offers status checks that have reported recently, and before that first run there are none to pick. Then, in GitHub → Settings → Branches, add a branch protection rule (or ruleset) for `main`:
   - require a pull request;
   - require the status checks **`validate`**, **`e2e`** and **`audit`** to pass. `validate` and `e2e` are the jobs of `.github/workflows/ci.yml`, and `audit` is the job of `.github/workflows/audit.yml`. Set each check's source to the **GitHub Actions** app, so a commit status of the same name from any other integration can't satisfy it;
   - optionally, require branches to be up to date before merging. CI tests the pull request's merge result, so this keeps that result the commit that lands.

   Then merge step 1's pull request.

   CI needs no secrets. Every action in both workflows is pinned to a release's full commit SHA, with the tag in a comment.

3. **Create the `preview` branch** from `main`, which now has step 1's Auth0 values: `git fetch origin && git push origin origin/main:refs/heads/preview`, once. Workers Builds' branch control can only pick a branch that exists. Add a branch protection rule for `preview` that restricts who can push to it: a push to `preview` deploys with the preview Worker's secrets (§2).
4. **Add the zone to Cloudflare** (§3, "The zone"), and wait until it is **Active**. Every later step that touches a domain needs it.
5. **Set the zone's TLS settings, and add the `www` record and redirect rule** (§3). They work before any Worker exists, so `www` redirects from the first production deploy on.
6. **Give both Workers their secrets** (§2, "Bootstrap"), in the account on the Workers Paid plan (§2, "Plan"). This creates the two Workers.
7. **Connect Workers Builds to the preview Worker first** (§2, "Workers Builds"), then push to `preview` (or retry its first build), read the first build log (§2, "The first build log"), check that its certificate is **Active** (§3, "TLS"), and run the smoke checks (§8) against `https://preview.bardictorch.org`.
8. **Then connect the production Worker**, start its first build (merge a pull request to `main`, or retry the build), check its certificate, and run the smoke checks against `https://bardictorch.org`.

## 2. Cloudflare Workers

There are two Workers, both described by `wrangler.jsonc`:

- the production Worker `bardic-torch-fe`, at the top level;
- the preview Worker `bardic-torch-fe-preview`, in `env.preview`.

The preview environment doesn't inherit `vars` or `secrets`, so `env.preview` repeats them. It inherits everything else set at the top level (wrangler 4.156): `main`, the compatibility settings and `upload_source_maps`, and also `routes` (the production custom domain), `workers_dev`, `preview_urls` and `observability`, which `env.preview` overrides explicitly. **Never remove `env.preview.routes`:** the preview Worker would inherit `bardictorch.org`, and its next deploy would move the production domain to the preview Worker. wrangler only warns about that; a hygiene test pins both Workers' `routes`, so the change can't pass CI. Both Workers have `workers_dev: false` and `preview_urls: false`, so neither serves a `*.workers.dev` URL or a version URL: only their custom domains (§3).

### Plan

Use the **Workers Paid** plan for the account. The Free plan limits each request to 10 ms of CPU time, and a server-rendered React page with the per-request environment validation and Sentry can exceed that on the heavier pages; a request over the limit fails with a Cloudflare error. The zone itself can stay on the Free plan. Both Workers and the zone must be in the same account: a custom domain can only be attached to a zone in the Worker's account.

### Bootstrap: secrets before the first build

`wrangler.jsonc` lists `AUTH_SESSION_SECRET` and `AUTH0_CLIENT_SECRET` under `secrets.required`, so wrangler refuses to deploy a Worker that lacks either. Workers Builds' first deploy of a new Worker would fail too. So set them first, once per Worker, from a checkout of `main`. Run `npm ci` first, so `npx wrangler` is the locked wrangler (4.156.1), not whatever version npx would fetch, then log in with `npx wrangler login`:

```sh
npm ci
npx wrangler login
npx wrangler secret put AUTH_SESSION_SECRET --name bardic-torch-fe            # creates the Worker
npx wrangler secret put AUTH0_CLIENT_SECRET --name bardic-torch-fe
npx wrangler secret put AUTH_SESSION_SECRET --name bardic-torch-fe-preview    # creates the Worker
npx wrangler secret put AUTH0_CLIENT_SECRET --name bardic-torch-fe-preview
# Optional (§6), for either or both:
npx wrangler secret put SENTRY_DSN --name bardic-torch-fe
```

Each command prompts for the value, so it never lands in the shell history. Generate `AUTH_SESSION_SECRET` with `openssl rand -base64 48`, once per Worker: the two values must differ.

On a Worker that doesn't exist yet, `wrangler secret put` offers to create it, as a draft Worker that holds only the secret. Answer yes. The draft has no routes, so it serves nothing on the site's hostnames. Its `workers.dev` URL serves an empty Worker until the first real deploy applies `workers_dev: false`; §8 checks that it is gone.

**Fallback,** if an account refuses the draft: deploy once from a local build instead. Build the mode (`npm run build` for `bardic-torch-fe`, or `npm run build:preview` for `bardic-torch-fe-preview`), then:

```sh
umask 077
printf 'AUTH_SESSION_SECRET=%s\nAUTH0_CLIENT_SECRET=%s\n' '<value>' '<value>' > /tmp/bt-secrets
npx wrangler deploy --secrets-file /tmp/bt-secrets
rm /tmp/bt-secrets
```

Only then connect Workers Builds.

**Later changes** to a secret: `npx wrangler secret put NAME` (production) or `npx wrangler secret put NAME --env preview` (preview), from a checkout, or the dashboard (the Worker → Settings → Variables and Secrets). Either deploys a new version of the Worker at once.

### Workers Builds

Connect each Worker to the GitHub repository: Workers & Pages → the Worker → Settings → Build → **Connect**. Fill in, for each:

| setting                            | production Worker                                      | preview Worker                                         |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Worker                             | `bardic-torch-fe`                                      | `bardic-torch-fe-preview`                              |
| build command                      | `npm run build:ci`                                     | `npm run build:ci`                                     |
| deploy command                     | `env -u WRANGLER_CI_OVERRIDE_NAME npx wrangler deploy` | `env -u WRANGLER_CI_OVERRIDE_NAME npx wrangler deploy` |
| root directory                     | `/`                                                    | `/`                                                    |
| production branch                  | `main`                                                 | `preview`                                              |
| builds for non-production branches | **off**                                                | **off**                                                |
| build variables                    | none                                                   | none                                                   |

So the production Worker has **Production branch:** `main`; **builds for non-production branches:** off. The preview Worker has **Production branch:** `preview`; **builds for non-production branches:** off.

- **Production branch** is Settings → Build → Branch control. Every push to it builds and deploys that Worker.
- **Builds for non-production branches** is the **Enable Preview Builds** checkbox under Branch control. Untick it on both Workers. It is the only branch filter Workers Builds has: with it on, a push to any other branch would build a Worker Preview with that Worker's secrets, and a push to `preview` would also start a build on the production Worker (and the reverse).
- **Deploy command.** Cloudflare's guide for wrangler environments adds `--env preview` to the preview Worker's deploy command. Leave it off here. The Cloudflare Vite plugin chooses the environment when it builds (`npm run build:ci` sets `CLOUDFLARE_ENV=preview` on the `preview` branch), and `npx wrangler deploy` deploys the built config, `build/server/wrangler.json`, which already names the preview Worker and holds only its settings.
- **Why `env -u WRANGLER_CI_OVERRIDE_NAME`.** Workers Builds gives `wrangler deploy` a match tag for the connection's Worker (`WRANGLER_CI_MATCH_TAG`), and wrangler refuses to deploy a config whose name isn't that Worker's: "The name in your … file (…) must match the name of your Worker". That check is what stops one connection deploying the other Worker's build. But when `WRANGLER_CI_OVERRIDE_NAME` is set, wrangler deploys under that name instead of the config's, with only a warning, and the match-tag check then passes (read in wrangler 4.156.1's source). Cloudflare doesn't document when Workers Builds sets it, so the deploy command removes it: a mismatch then fails the deploy instead of putting a preview build on the production Worker (or the reverse). `env -u` is GNU coreutils, in the build image (Ubuntu 24.04).
- **Wrangler** is the version in `package.json` (Workers Builds uses it).

**Node and npm.** The build image preinstalls Node 22 and 24 and npm 10, and the build needs Node 26.13.0 and npm 12.2.1 (`package.json` `engines`):

- **Node** comes from `.nvmrc` (26.13.0). Workers Builds reads it from the root directory and installs that version when the build starts. Don't also set a `NODE_VERSION` build variable: Cloudflare doesn't say which wins when both are set.
- **npm** comes from `package.json`'s `packageManager` (`npm@12.2.1`), which Workers Builds installs before the dependencies. It is the only way to choose npm there; `engines.npm` doesn't. It matters: npm 12 runs only the install scripts that `allowScripts` approves.

**The first build log** of each Worker must show:

- `v26.13.0` for Node and `12.2.1` for npm. Only if the log shows another Node (e.g. 24.x, the image's default), add the build variable `NODE_VERSION=26.13.0` (Settings → Build → Variables and Secrets) as a fallback and retry; if that fails too, stop and report it. Don't downgrade Node.
- the line "Building in production mode" (or "preview mode"), from `build.mjs`.
- a deploy to the right Worker, with its custom domain, and no "Failed to match Worker name" warning.

If Workers Builds refuses the deploy because the deployed config's name (`bardic-torch-fe-preview`) isn't the root `wrangler.jsonc`'s `name`, change the preview Worker's deploy command to `env -u WRANGLER_CI_OVERRIDE_NAME npx wrangler deploy --config build/server/wrangler.json`. This isn't expected: wrangler checks the name of the config it deploys, which is the built one.

### What `build:ci` does

`npm run build:ci` (`node scripts/build.mjs --from-branch`) reads the `WORKERS_CI_BRANCH` variable that Workers Builds sets:

- `main` → the **production** build for `bardic-torch-fe`: no stub sign-in.
- `preview` → the **preview** build for `bardic-torch-fe-preview` (with `CLOUDFLARE_ENV=preview`, so the built config names the preview Worker): still no stub sign-in.
- Empty or unset → the build **fails** ("WORKERS_CI_BRANCH is empty: refusing to guess a deploy target"): the mode decides which Worker is deployed, so it never guesses.
- Any other branch → the build **fails** ("Branch … is not deployed"). This catches non-production builds turned on by mistake.

Whether the build's Worker is the connection's is checked at deploy, by wrangler's match tag (see "Deploy command" above): a connection can't deploy the other Worker's build. The build deletes the `build/server/.dev.vars` the Cloudflare Vite plugin writes, so no local value ends up in a build.

A build log that shows the wrong mode, or `WORKERS_CI_BRANCH is empty`, means the connection is misconfigured. Fix the connection, never the build.

### Why only one preview branch

A preview build runs with the preview Worker's secrets, and Workers Builds builds a branch whether or not CI passed. The preview Worker shares the production Auth0 application (its client secret) and the production API (§4). If every branch were built, anyone who can push a branch could deploy unreviewed code that reads the client secret or uses real tokens against `api.bardictorch.org`. With one preview branch, the trade-off is:

- only people who may push to `preview` can run code with those secrets, so protect `preview` like `main` in GitHub (restrict who can push to it);
- feature branches get no deployment of their own. Push a branch to `preview` to try it (§7), or run it locally (README).

Workers' own previews aren't used, for the same reason:

- **Worker Previews** (preview builds) give every branch or pull request a URL, running with the secrets the Worker's previews share. Their URLs also vary per branch, so Auth0's callback and logout lists couldn't name them exactly, and the `__Host-` state cookie only works on the host it was set on.
- **Version URLs** run with production's own bindings. Cloudflare's guidance is "Do not use Version URLs for branch or pull request testing".

Cloudflare recommends wrangler environments for a persistent staging Worker, which is what `env.preview` is: a separate Worker with its own secrets and its own fixed origin. The preview's `AUTH_SESSION_SECRET` differs from production's, and `__Host-` cookies are host-only, so a preview session can't be replayed on production.

A separate Auth0 application for previews would remove the shared client secret too. It isn't used: previews would then sign in against a different set of Auth0 users from production.

### Runtime

- **Compatibility.** `wrangler.jsonc` sets the compatibility date `2026-11-01` and the `nodejs_compat` flag (`@sentry/cloudflare` needs it, §6) for both Workers. Change them in `wrangler.jsonc` only. The date must be one the bundled workerd supports (a hygiene test ties them), so bump it together with wrangler.
- **Static assets.** The static files (`build/client`: `/assets/*`, `/favicon.svg`, `/site.webmanifest`) are Workers static assets, wired up by `@cloudflare/vite-plugin`. A request for one is answered without running the Worker. `public/_headers` gives `/assets/*` a one-year immutable cache. Cloudflare doesn't apply `_headers` to responses the Worker makes, so the app sets its own headers.
- **The Worker** is `workers/app.ts` (Sentry's `withSentry`, §6, around `app/server/worker.server.ts`). For every request it validates the environment, gives React Router the request's context (the validated environment and a per-request auth cache, `app/server/context.server.ts`), and adds the security headers to any response without a CSP. Before React Router runs, it answers:
  - an `/assets/*` file that doesn't exist (a stale hashed URL) with a plain 404 (`no-store`, security headers), never a rendered page;
  - a cross-origin POST, PUT, PATCH or DELETE to a page or `.data` URL with 400 "Bad Request" (`no-store`). React Router refuses those itself, but would report them to Sentry.

  The resource routes (`/api/*`, `/auth/*`, `/resources/theme`) keep their own same-origin check, a 403; `/robots.txt` and `/sitemap.xml` are read-only resource routes with no check to make. Everything else is set per request by the app: the security headers and the nonce CSP on every response the Worker makes (resource routes and redirects included), `Cache-Control: private, no-cache` on documents and `.data` answers while signed out, and `no-store` on every document and `.data` answer while signed in, on `/settings` and its data, on the auth routes and on the proxies.

- **Catalogue reads are anonymous.** The catalogue's pages (every `GET /v1/...` the read UI makes, in loaders: pieces, persons, terms, collections, events, revisions) are sent to the API with no `Authorization` header, whether or not the reader is signed in, so the API must serve them to anyone and the Worker needs no credentials for them. Responses are not cached upstream in FE2 (every page request reads the API again; the Worker's own Cache API waits for the backend's caching, B11). The pages themselves are `private, no-cache` (`no-store` while signed in), with `Vary: Cookie`.
- **Indexing.** Only the production build is indexable. `robots.txt` on production allows crawling and disallows only `/auth/`, `/api/`, `/resources/` and `/settings`; the pages that say `noindex` themselves (`/search`, histories, revisions, filtered lists) are deliberately not disallowed, so crawlers can read that. The preview Worker (and the e2e and development builds) answer `Disallow: /` **and** send `X-Robots-Tag: noindex` on every response the Worker makes, the sitemap included (static files such as `/assets/*` never reach the Worker; the `Disallow` covers them): the `Disallow` stops crawling, and the header covers a preview URL that is found elsewhere. Both are on purpose.
- **Sitemap.** `/sitemap.xml` is one `urlset` of the pages and every public catalogue entry, `Cache-Control: public, max-age=3600`. The categories are one `listTerms` read; the pieces, bards, collections and events are read 100 at a time, one page after another, so the sitemap costs about one API call per 100 entries. Workers allow 50 subrequests per request on the free plan and 1,000 on the paid plan, so on the free plan a catalogue past about 5,000 entries needs the plan changed or the sitemap split. Restricted pieces and stub people are left out. Any failed read makes the whole sitemap a 503 with `Retry-After`; no partial sitemap is ever served.
- **Source maps.** `upload_source_maps` uploads the Worker's source maps with each deploy, so stack traces in Workers Logs are readable. Sentry source-map upload isn't set up.

### Logs (observability)

Both Workers have the same `observability` block:

```jsonc
"observability": {
  "enabled": true,
  "redact_query_string": true,
  "logs": { "invocation_logs": false },
}
```

- **`enabled: true`** turns on Workers Logs (the Worker → Observability → Logs). It keeps the Worker's own `console.*` output, errors and uncaught exceptions: the configuration errors, the Auth0 and API failures with their operation ids, and every server error (§6). None of them logs a request URL.
- **`logs.invocation_logs: false`** turns off the per-request invocation log. That is the record Cloudflare keeps of each request's URL and response, and a request URL can carry one-time secrets: `/auth/callback?code=…&state=…`. No log or error report may keep those (the same rule as Sentry's, §6).
- **`redact_query_string: true`** removes the query string from request URLs in whatever else Workers Logs or traces record, so a future log line or an enabled trace still couldn't keep `?code=…&state=…`. The key is in wrangler's config schema (added in wrangler 4.128.0) but not yet on Cloudflare's documentation pages. Traces are not enabled.
- **Not used: `head_sampling_rate`.** It samples whole invocations: any rate above 0 still stores the URLs it samples, and 0 would also drop the console logs.

**Check on the first deploy,** after a sign-in on each Worker: Observability → Logs must show no invocation records and no URL with `code=` or `state=`. Workers Logs is billed as Cloudflare Observability from 2026-12-01; the volume here is the console logs only.

### Environment variables

**`wrangler.jsonc` is the source of truth for plain-text variables**, per Worker (`vars`). The dashboard can't edit them while it exists, and a deploy replaces them. Change them with a commit.

**Secrets** are set with `npx wrangler secret put` (see "Bootstrap" above) or in the dashboard, once per Worker. They are never committed. The two required ones are listed in `secrets.required`, so a deploy without them fails, and the generated `Env` type (`worker-configuration.d.ts`) has them.

| variable                     | kind                    | production                      | preview                           |
| ---------------------------- | ----------------------- | ------------------------------- | --------------------------------- |
| `BARDIC_TORCH_API_BASE_URL`  | plain, `wrangler.jsonc` | `https://api.bardictorch.org`   | `https://api.bardictorch.org`     |
| `AUTH0_DOMAIN`               | plain, `wrangler.jsonc` | the tenant domain               | the same                          |
| `AUTH0_CLIENT_ID`            | plain, `wrangler.jsonc` | the application's client ID     | the same                          |
| `AUTH0_DEFAULT_REDIRECT_URI` | plain, `wrangler.jsonc` | `https://bardictorch.org`       | `https://preview.bardictorch.org` |
| `AUTH0_AUDIENCE`             | plain, `wrangler.jsonc` | `https://api.bardictorch.org`   | the same                          |
| `TURNSTILE_SITE_KEY`         | plain, `wrangler.jsonc` | the Turnstile widget's site key | the same                          |
| `AUTH_SESSION_SECRET`        | **secret**, required    | random, at least 32 characters  | a **different** random value      |
| `AUTH0_CLIENT_SECRET`        | **secret**, required    | the application's client secret | the same                          |
| `SENTRY_DSN`                 | **secret**, optional    | the Sentry DSN, or unset        | the same, or unset                |
| `AUTH_MODE`                  | never set               | —                               | —                                 |

Notes on the variables:

- **`AUTH0_DEFAULT_REDIRECT_URI`** is the site's origin, with no path and no trailing slash. Sign-in comes back to `<it>/auth/callback`.
- **`AUTH0_DOMAIN`** is the host Auth0 issues tokens from: the tenant domain, or the custom domain if the tenant has one. The ID token's issuer must be exactly `https://<AUTH0_DOMAIN>/` (§8).
- **`AUTH_SESSION_SECRET`** signs the `__Host-bt_session` and `__Host-bt_return_to` cookies. Generate it with `openssl rand -base64 48`. Using a different value in preview means a preview session can never be replayed on production. Changing it signs everyone out.
- **`SENTRY_DSN`** is not sensitive (the browser receives it too), but it is kept out of the repository as a secret. Without it, nothing is sent to Sentry. It can't be listed in `secrets.required`, because it is optional.
- **`TURNSTILE_SITE_KEY`** is the contact form's Turnstile widget (§5). It is public. Development (`.dev.vars.example`, `npm run dev:fixtures`) and e2e use Cloudflare's test key `1x00000000000000000000AA`, whose widget always passes.
- **`AUTH_MODE`** must never be set. Production and preview builds don't contain stub sign-in, and they ignore `AUTH_MODE=stub` with a logged error.

Every request validates these variables (`app/server/env.server.ts`). If one is missing or malformed, or is still a placeholder starting `replace-with` (as `AUTH0_CLIENT_ID` and `TURNSTILE_SITE_KEY` are in `wrangler.jsonc` until steps 1 of §1 and §5 are done), every page is a plain **"Site configuration error"** page with status 500. The variable's name, never its value, is logged ("Invalid environment: …"), and shows in Workers Logs.

A plain-text variable changes with the next deploy of the commit that changes it. A secret set with `wrangler secret put` deploys a new version of the Worker straight away.

## 3. DNS, custom domains and TLS

### The zone

The `bardictorch.org` zone must be on Cloudflare, in the same account as the Workers, before anything else in this section or any deploy: a Worker's custom domain needs the zone. Once:

1. Cloudflare dashboard → **Add a domain** → `bardictorch.org`. Choose a plan (Free is enough for the zone). When offered to import existing DNS records, skip it, or delete any imported record for `bardictorch.org`, `www` or `preview`: custom domains create their own records, and can't be created over an existing one.
2. At the registrar, replace the nameservers with the two that Cloudflare assigns to the zone. If DNSSEC is on at the registrar, turn it off there first; once the zone is active, turn on DNSSEC in Cloudflare (DNS → Settings) and add the DS record it shows at the registrar.
3. Wait until the zone shows **Active** (it can take up to a day; Cloudflare emails when it is). Deploys and custom domains fail until then.

### The site: `bardictorch.org`, `www` and `preview`

1. **Custom domains come from `wrangler.jsonc`.** Each Worker's `routes` lists its custom domain (`"custom_domain": true`):
   - `bardictorch.org` for `bardic-torch-fe`;
   - `preview.bardictorch.org` for `bardic-torch-fe-preview`.

   `www.bardictorch.org` is deliberately not a custom domain (step 3). Each deploy applies them. Cloudflare creates each hostname's proxied DNS record and edge certificate itself, but only if the hostname has no DNS record yet: a custom domain can't be created on a hostname with an existing record. So don't create these records by hand, and don't also add the domains in the dashboard. Keeping them in `wrangler.jsonc` keeps them in version control.

2. **TLS.** Set these in the zone's SSL/TLS settings once the zone is active, before the first deploy:
   - encryption mode **Full (strict)**. The Workers are their own origin, so this mode only affects other proxied records; it stops any of them from silently accepting an invalid origin certificate;
   - **Always Use HTTPS** on. It also sends `http://www…` to HTTPS before the redirect below;
   - minimum TLS version **1.2**.

   The app's cookies are all `Secure`, so the site is HTTPS-only by design. Turn on HSTS only once every name serves correctly.

   Cloudflare issues and renews an edge certificate for each custom domain when the deploy creates it. **After each Worker's first deploy**, wait until its certificate shows **Active** (the Worker → Settings → Domains & Routes) before the smoke checks.

3. **Redirect `www` to the apex.** The session, returnTo and Auth0 state cookies are `__Host-` cookies, which belong to one host, and `AUTH0_DEFAULT_REDIRECT_URI` is the apex. So a sign-in started on `www` would lose its state cookie on the way back, and logout's `returnTo` (the request's origin) isn't an allowed logout URL there. So `www` never serves the app. It is a redirect, set up before the first production deploy, as Cloudflare documents it (Custom Domains, "Redirect from www to root"):
   - **DNS record:** in the zone's DNS, add `A www → 192.0.2.0`, **Proxied** (orange cloud). `192.0.2.0` is a reserved documentation address: the record only lets Cloudflare's edge receive `www` requests for the rule. (Or `AAAA www → 100::`, also proxied.)
   - **Rule:** a **Single Redirect** (Rules → Redirect Rules → Create rule, or the "Redirect from WWW to root" template). **When:** wildcard pattern, request URL `https://www.*`. **Then:** target URL `https://${1}`, status **301**, **preserve query string** on. Always Use HTTPS (step 2) sends `http://www…` to HTTPS first.

   The rule runs before anything else answers. If it is ever missing or turned off, `www` serves a Cloudflare error, not a half-working copy of the site. That is why `www` isn't a custom domain of the Worker. `_redirects` can't do this: it can't redirect between hostnames.

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

| setting                             | value                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application Login URI               | `https://bardictorch.org/auth/login`                                                                                                                      |
| Allowed Callback URLs               | `https://bardictorch.org/auth/callback`, `https://preview.bardictorch.org/auth/callback`                                                                  |
| Allowed Logout URLs                 | `https://bardictorch.org`, `https://preview.bardictorch.org`                                                                                              |
| Allowed Web Origins                 | `https://bardictorch.org`, `https://preview.bardictorch.org` (the app makes no browser-side Auth0 calls, so this is only for completeness)                |
| Credentials → Authentication Method | **Client Secret (Basic)**: openid-client (`ClientSecretBasic`) sends the client credentials in an HTTP Basic header to the token and revocation endpoints |
| Advanced → Grant Types              | Authorization Code, Refresh Token                                                                                                                         |

How these are used:

- **Callback URLs.** `/auth/login` sends Auth0 `redirect_uri = AUTH0_DEFAULT_REDIRECT_URI + "/auth/callback"`, so each Worker's value must be listed. The callback sends the same configured URI in the code exchange, whatever host the request came in on.
- **Logout URLs.** `POST /auth/logout` clears the session and redirects to `https://<AUTH0_DOMAIN>/v2/logout?client_id=…&returnTo=<the request's origin>`, so each origin must be listed. CSP `form-action` already allows the Auth0 domain.
- **Client Secret (Basic).** As RFC 6749 §2.3.1 requires, the client ID and secret are form-encoded before they are Base64-encoded (a `-` in the secret is sent as `%2D`); Auth0 decodes them that way. With another authentication method set here, the code exchange fails with `invalid_client` (§8).
- **Preview.** Sign-in and log-out work on `https://preview.bardictorch.org`, the preview Worker's only URL: there are no version or `workers.dev` URLs (§2).
- **Local development.** Don't add `localhost` URLs to this application. For `npm run dev` against a real tenant, create a second Regular Web Application (e.g. "Bardic Torch (development)") with Allowed Callback URLs `http://localhost:5173/auth/callback`, Allowed Logout URLs `http://localhost:5173`, the same API and connections, and put its client ID and secret in `.dev.vars` (README).

**API** (Applications → APIs → Create API):

- **Identifier (audience):** `https://api.bardictorch.org`. This is `AUTH0_AUDIENCE`, and must be what the backend expects as its audience. Signing algorithm RS256.
- **Allow Offline Access: on.** The app asks for `openid offline_access` (`app/server/auth.server.ts`); it reads no profile claims and stores only the tokens. Without offline access, Auth0 issues no refresh token: sign-in still works, but the reader is signed out when the access token expires instead of it being refreshed.
- **Access token lifetime:** the app refreshes the token 5 minutes before it expires, so any lifetime well above that works (the default is 24 hours). The session cookie itself lasts 7 days.

**The ID token** is checked on every sign-in: its issuer must be `https://<AUTH0_DOMAIN>/`, its audience the client ID, its algorithm RS256, and its `iat`/`exp` within 30 seconds of the Worker's clock. Its signature isn't checked: it comes straight from Auth0's token endpoint over TLS (OpenID Connect Core §3.1.3.7).

**Refresh tokens** (in the application's settings):

- **Rotation** can be on or off. The app stores the new refresh token whenever Auth0 returns one, and keeps the old one when Auth0 doesn't rotate it. A response without `expires_in` gets a 24-hour lifetime.
- **Failures.** When a refresh fails for any reason (a refused token, Auth0 down, slow or answering 5xx), the current access token is used while it is still valid; once it has expired the session is ended and the reader is signed out. Every Auth0 call (code exchange, refresh, revocation) gives up after 5 seconds.
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

## 5. Turnstile

The contact, takedown and opt-out form (`/contact`, which also reports links) is protected by Cloudflare Turnstile. The browser loads the widget from `https://challenges.cloudflare.com` (allowed in the CSP's `script-src` and `frame-src`), and the API verifies the token (`POST /v1/contact`, action `contact`). Create the widget before the first deploy:

1. Go to Cloudflare dashboard → Turnstile → Add widget.
   - **Name:** "Bardic Torch contact form".
   - **Hostnames:** `bardictorch.org`. The API accepts a token minted on one hostname only (its `TURNSTILE_HOSTNAME`), and the preview Worker uses the production API, so the contact form works on production alone: on preview it answers that the robot check failed.
   - **Widget mode:** Managed.
2. **Site key.** It is public: replace the placeholder `TURNSTILE_SITE_KEY` in `wrangler.jsonc`, in both the top-level `vars` and `env.preview.vars`, with a commit. Until then every page is the "Site configuration error" page (§2).
3. **Secret key.** It goes to the **API**, not the frontend: set it in the API's dokku config as `TURNSTILE_SECRET_KEY`, with `TURNSTILE_HOSTNAME=bardictorch.org` (the backend's DEPLOY.md). It is never a Worker variable.
4. **Local development and e2e** use Cloudflare's published test site key `1x00000000000000000000AA` (always passes). e2e runs offline, so `e2e/support/test.ts` answers the widget's script with a local stand-in that gives the test token `XXXX.DUMMY.TOKEN.XXXX`, as the test key's widget does.

## 6. Sentry (optional)

- **Setting it up.** Create a project for the browser and Workers (JavaScript → React Router or Cloudflare), then set its DSN as the `SENTRY_DSN` secret of the production and/or preview Worker (`npx wrangler secret put SENTRY_DSN`, with `--env preview` for the preview Worker), which deploys it. With a DSN set:
  - the browser reports errors (`@sentry/react`, started by `SentryProvider` in the root `Layout`, and by an error page that is the first thing rendered), and traces page loads and navigations, with spans named by URL path (Sentry's React Router integration can only name them by route for a router it creates, and React Router's `HydratedRouter` creates its own);
  - the server reports errors with `@sentry/cloudflare`: `withSentry` in `workers/app.ts` gives every request its own Sentry scope and reports what the Worker throws, and `entry.server.tsx` reports what React Router catches: loader and action errors (`handleError`, except abandoned requests) and render errors;
  - the CSP's `connect-src` gains the DSN's ingest origin;
  - error pages show the Sentry event ID as an error reference.
- **Privacy.** Both SDKs collect nothing about the reader or the request: `dataCollection` (`app/constants/sentry.ts`, shared by both runtimes) turns off user information and the IP address, cookies, headers, request and response bodies and query strings. On the server, `beforeSend` and `beforeSendSpan` (`app/server/sentry.server.ts`) also strip the query string from events and spans (`/auth/callback?code=…&state=…` carries one-time secrets), and `beforeSendSpan` drops the User-Agent, which the SDK records on spans whatever `dataCollection` says.
- **Runtime flag.** `@sentry/cloudflare` needs the `nodejs_compat` compatibility flag, which `wrangler.jsonc` sets for both Workers.
- **Always:** every server error is also `console.error`'d, so it shows in Workers Logs (§2, "Logs") with or without Sentry.
- **Without it,** nothing is initialised, nothing is sent and no reference is shown.

## 7. Deploying

- **Production:** merge to `main`. The required checks run on the pull request; Workers Builds builds `main` in production mode and deploys it to `bardic-torch-fe`, served on `bardictorch.org`.
- **Preview:** push to `preview`, e.g. `git push origin HEAD:preview`. Workers Builds builds it in preview mode, and deploys it to `bardic-torch-fe-preview`, served on `https://preview.bardictorch.org`. Sign-in works there against the same Auth0 application and API.
- **Other branches** are not deployed (§2). CI still runs on their pull requests, and the `audit` job weekly.

Until production is signed off, deploy to the preview Worker only.

## 8. Smoke checks

Run these after the first deploy of each Worker, and after any change to the Workers Builds settings, the domains or the Auth0 application. Set `SITE=https://preview.bardictorch.org` for the preview Worker, and `SITE=https://bardictorch.org` for production.

```sh
# 1. The home page renders with the app's headers.
curl -sI "$SITE/" | grep -iE '^(HTTP|content-security-policy|cache-control|vary|x-content-type-options)'
#    → 200; CSP with script-src 'nonce-…'; cache-control: private, no-cache; vary: Cookie; nosniff

# 2. Static assets are cached for a year.
curl -s "$SITE/" | grep -o '/assets/[^"]*\.css' | head -1 | xargs -I{} curl -sI "$SITE{}" | grep -i cache-control
#    → public, max-age=31536000, immutable

# 3. A missing asset is a plain 404 from the Worker, never cached, with the security headers.
curl -sI "$SITE/assets/does-not-exist.js" | grep -iE '^(HTTP|cache-control|content-security-policy|x-content-type-options)'
#    → 404; cache-control: no-store; a CSP; nosniff

# 4. Sign-in goes to Auth0 with this origin's callback, and sets the state and returnTo cookies.
curl -sI "$SITE/auth/login?returnTo=/settings" | grep -iE '^(HTTP|location|set-cookie)'
#    → 302 to https://<AUTH0_DOMAIN>/authorize?…redirect_uri=<SITE>%2Fauth%2Fcallback…
#      set-cookie: __Host-bt_auth0:<state>=…; set-cookie: __Host-bt_return_to=…

# 5. Stub sign-in is absent: ?as is ignored, and it still goes to Auth0.
curl -sI "$SITE/auth/login?as=contributor" | grep -i '^location'

# 6. A cross-origin form post is refused.
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Origin: https://evil.example" "$SITE/settings"   # 400

# 7. Unknown pages are the app's 404; help pages render.
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/no-such-page"    # 404
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/help/licence"    # 200

# 8. www redirects to the apex, keeping path and query (production only).
curl -sI "https://www.bardictorch.org/x?y=1" | grep -iE '^(HTTP|location)'
#    → 301, location: https://bardictorch.org/x?y=1

# 9. No other URL serves a version: the deployment is listed, and workers.dev doesn't serve the app.
npx wrangler deployments list --name bardic-torch-fe            # or bardic-torch-fe-preview
curl -s -o /dev/null -w '%{http_code}\n' "https://bardic-torch-fe.<account-subdomain>.workers.dev/"
#    → not the app (a Cloudflare error page, or no route); the same for bardic-torch-fe-preview

# 10. robots.txt: crawlable on production, closed on preview.
curl -s "$SITE/robots.txt"
#    → production: User-agent: * / Disallow: /auth/ /api/ /resources/ /settings / Sitemap: https://bardictorch.org/sitemap.xml
#      preview:    User-agent: * / Disallow: /
curl -sI "$SITE/" | grep -i '^x-robots-tag'
#    → production: nothing; preview: x-robots-tag: noindex (on every response, the sitemap included)

# 11. The sitemap (fetched from the API, so this also proves anonymous reads).
curl -sI "$SITE/sitemap.xml" | grep -iE '^(HTTP|content-type|cache-control)'
#    → 200; application/xml; public, max-age=3600
curl -s "$SITE/sitemap.xml" | grep -c '<loc>'                   # the pages, plus about one per unrestricted entry

# 12. A piece page: its canonical address is on this origin.
curl -s "$SITE/pieces/$(curl -s "$SITE/sitemap.xml" | grep -o '/pieces/[^<]*' | head -1 | cut -d/ -f3)" | grep -oE '<link rel="canonical"[^>]*>' | head -1

# 13. The API is up, and so is its database.
curl -s https://api.bardictorch.org/healthz                      # {"status":"ok"}
curl -s https://api.bardictorch.org/readyz                       # {"status":"ok"}
```

With the API stopped (or `BARDIC_TORCH_API_BASE_URL` pointing at nothing, on preview only), the catalogue's pages are the "Bardic Torch is resting" page: 503 with `Retry-After: 30`, still inside the site shell, and `/sitemap.xml` is a 503 with `Retry-After` and no partial list. Help pages, the home page (with its counts and categories regions showing their errors) and sign-in keep working.

In the dashboard, each Worker's Settings → Domains & Routes shows `workers.dev` and Preview URLs **disabled**, and only its custom domains, **Active**.

Then, in a browser:

1. **Sign in with Google**, then with Facebook. Each comes back to the page you started on, and the account menu shows your display name. If it says "We couldn't load your profile", the API or the audience is wrong. If sign-in comes back signed out, Workers Logs has an "Authentication callback error:" line with openid-client's reason:
   - `invalid_client` (Auth0 answers 401 to the code exchange): the application's Authentication Method isn't **Client Secret (Basic)** (§4), or `AUTH0_CLIENT_SECRET` isn't the application's. The client credentials are form-encoded before Base64, as RFC 6749 requires; Auth0 accepts that, so check the setting and the secret first.
   - `OAUTH_JWT_CLAIM_COMPARISON_FAILED` for the claim `iss`: `AUTH0_DOMAIN` isn't the host Auth0 issues tokens from. If the tenant has a custom domain, use that; the issuer must be exactly `https://<AUTH0_DOMAIN>/`. For the claim `aud`, `AUTH0_CLIENT_ID` is wrong.
   - `OAUTH_JWT_TIMESTAMP_CHECK_FAILED` for `iat` or `exp`: the ID token's times are more than 30 seconds off the Worker's clock. That shouldn't happen on Cloudflare; retry, and report it if it persists.
2. **`/settings`:** rename yourself (a toast confirms it).
3. **Log out.** You pass through Auth0 and come back signed out. An Auth0 "invalid returnTo" error means §4's logout URLs are wrong.
4. **Switch the theme** to dark, reload, and it stays dark, with no flash.
5. **The console** shows no CSP violations.
6. **Workers Logs** (§2, "Logs") shows no invocation records and no URL with `code=` or `state=` from the sign-ins above.

## 9. Rollback

- **Fastest:** the Worker → Deployments → find the last good version → **Rollback**, or `npx wrangler rollback` from a checkout after `npm ci` (with `--name bardic-torch-fe-preview` for the preview Worker). `npx wrangler versions list` shows the candidates (`npx wrangler versions list --name bardic-torch-fe-preview` for the preview Worker). It is live within seconds. Use it for a bad commit, not for a bad variable.
- **Then fix forward:** revert the bad commit on `main` (`git revert <sha>`, via a pull request so the checks run). The next build replaces the rollback.
- **A bad variable or secret:** don't roll back. Correct the value, which makes a new version: a commit for `wrangler.jsonc` variables, which the next deploy applies (or retry the last build); `npx wrangler secret put` for secrets, which deploys at once.
- **A failed build** deploys nothing: the previous version keeps serving. Fix the cause, then retry the build from the Worker's build history or push the fix.
- **An API change that breaks the frontend:** roll back the frontend as above. Afterwards, `npm run sync:api -- <the backend's openapi/api.yaml>`, fix what `validate` reports, and redeploy.
- **Auth0 or DNS changes** are not versioned with the site. Undo them in their dashboards: §3 and §4 list every value.
