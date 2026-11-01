# Bardic Torch (frontend)

Bardic Torch is a community index of SCA bardic songs, stories and poems, and of the bards who made them, so they can be found, sung and passed on. It is an index, not an archive: every piece points to where its lyrics, recordings or video already live. **Links only, never lyrics.** It replaces the original wiki at https://bardictorch.miraheze.org, whose prose stays CC BY-SA 4.0.

This repository is the web frontend at https://bardictorch.org. It is a Remix 2 app (Vite 5, React 18, Tailwind 3) on Cloudflare Pages. The API lives in a separate backend repository and is served at https://api.bardictorch.org.

This is milestone FE1, the foundation:

- the wiki-style layout, with a header, sidebar, mobile bottom app bar and footer;
- the design system, in light and dark;
- Auth0 sign-in with Google or Facebook;
- the settings page, for your display name and API tokens;
- the static help pages and the home page.

Catalogue pages come in FE2. Until then, Browse, the facets and search link to the original wiki.

## Key concepts

- **Contract-first API.** `api/openapi.yaml` is the backend's OpenAPI 3.1 spec, vendored byte for byte with `npm run sync:api -- <path|url>`. Nobody edits it here.
  - `app/api/schema.gen.ts` is generated from it (`npm run gen:api`); `check:api` fails if that file is stale.
  - The zod schemas in `app/schemas/api.ts` validate every upstream response, and are type-checked against the generated types in both directions.
- **The browser never calls the API.** Loaders, and the proxy routes `PATCH /api/me`, `POST /api/tokens` and `DELETE /api/tokens/:tokenId`, call it from the Pages Function through `app/server/api.server.ts`.
  - The access token lives in the server-side session and is sent as `Authorization: Bearer auth0|<jwt>`.
  - The proxies accept form-encoded bodies, check same-origin (CSRF), validate the input, and map every API error code to the app's own wording.
- **Sessions.** remix-auth with the Auth0 strategy keeps only the Auth0 tokens in a signed cookie session, `__Host-bt_session` (HttpOnly, Secure, SameSite=Lax), and refreshes the access token before it expires.
  - `/auth/login` remembers where to come back to in `__Host-bt_return_to`. `/auth/callback` validates it again with `safeReturnTo`.
  - Log out is a POST to `/auth/logout`, which then goes to Auth0's logout.
- **Build modes.**

  | mode          | command                 | stub sign-in | `/styleguide` |
  | ------------- | ----------------------- | ------------ | ------------- |
  | `production`  | `npm run build`         | never        | left out      |
  | `preview`     | `npm run build:preview` | never        | included      |
  | `e2e`         | `npm run build:e2e`     | compiled in  | included      |
  | `development` | `npm run dev`           | compiled in  | included      |

  Cloudflare Pages runs `npm run build:pages`. It picks `production` on `main`, or whenever the branch is unknown, and `preview` otherwise. `check:prod-build` proves that production and preview builds contain no stub code.

- **Fixture API.** `test/fixture-api/` implements the FE1 operations from one operation table, with state kept per user and failures injected on request. The same table drives the msw handlers in unit tests, the HTTP server in e2e, and `npm run dev:fixtures`. Every fixture response is validated against the spec.
- **Design tokens.** All colour comes from `app/styles/tokens.ts`.
  - `npm run gen:tokens` generates the CSS variables, the favicon and the manifest colours.
  - Tailwind's palette is replaced by the tokens, so there are no `dark:` classes and no raw colours.
  - The theme (light, dark or system) is a `theme` cookie that the server renders, so the page never flashes.
- **Security headers.** Every document carries a per-request nonce CSP and the other security headers, set in `app/entry.server.tsx`. `public/_headers` only sets caching for `/assets/*`.

Design: [docs/DESIGN.md](docs/DESIGN.md) · Tests: [docs/TESTING.md](docs/TESTING.md) · Deploying: [docs/DEPLOY.md](docs/DEPLOY.md) · Working rules: [CLAUDE.md](CLAUDE.md)

## How a request flows

```mermaid
flowchart TD
    Browser["Browser"]
    Static["Static files: /assets/*, favicon, manifest"]
    Function["Pages Function: Remix server render"]
    Proxy["Proxy routes /api/*"]
    Auth["Auth routes /auth/*"]
    Session["Session cookie"]
    Auth0["Auth0: Google, Facebook"]
    API["Bardic Torch API"]
    Wiki["Original wiki"]

    Browser -- "excluded by _routes.json" --> Static
    Browser -- "pages and form posts" --> Function
    Function --> Proxy
    Function --> Auth
    Auth -- "sign in, refresh, log out" --> Auth0
    Auth -- "writes" --> Session
    Proxy -- "bearer from" --> Session
    Function -- "loaders and proxies, server side" --> API
    Browser -- "catalogue links until FE2" --> Wiki
```

## Getting started

You need Node 22 (see `.nvmrc`).

```sh
npm ci
npm run dev:fixtures   # fixture API + Vite dev server with stub sign-in
```

Then open http://localhost:5173/auth/login?as=contributor. You are signed in as a fixture user and can use `/settings` with no Auth0 or API at all.

To run against a real Auth0 tenant and the API, copy `.dev.vars.example` to `.dev.vars`, fill it in, then run `npm run dev`. Use a separate Auth0 development application whose Allowed Callback URLs include `http://localhost:5173/auth/callback` and whose Allowed Logout URLs include `http://localhost:5173` (docs/DEPLOY.md §4, Local development); the production application doesn't list `localhost`.

## Checks

| command            | what it runs                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `npm run validate` | format:check, lint, typecheck, check:api, check:tokens, check:contrast, every vitest test, check:prod-build |
| `npm run test:e2e` | Playwright: the prod phase, then the stub phase; needs Chromium                                             |

CI (`.github/workflows/ci.yml`) runs both, as the required `validate` and `e2e` jobs. [docs/TESTING.md](docs/TESTING.md) explains the layers.

## Licence

The code is MIT ([LICENSE](LICENSE)). The help pages are adapted from the original wiki and are CC BY-SA 4.0, credited to its contributors; see `/help/licence`.
