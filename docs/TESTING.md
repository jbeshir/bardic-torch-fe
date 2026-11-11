# Testing

Tests are proportionate: a component gets one only when it has behaviour, a loader or action runs against the canned API, and every page is rendered once on the server. `npm run validate` runs everything except e2e and the audit.

| layer          | what it covers                                                                 | where                                                                      | command                            |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| unit/component | helpers, server modules, loaders and actions, components with behaviour        | next to the code, `app/**/*.test.{ts,tsx}`; scripts in `scripts/*.test.ts` | `npm run test:run` (in `validate`) |
| repo checks    | exact pins, CI and ops files, no raw colours, the Worker entry                 | `test/*.test.ts`                                                           | `npm run test:run` (in `validate`) |
| e2e            | the built Worker in Chromium, served by `wrangler dev` against the fixture API | `e2e/`                                                                     | `npm run test:e2e`                 |

`validate` also runs the checks `check:types`, `check:api`, `check:contrast` and `check:prod-build` (see CLAUDE.md).

## Unit and component tests

- **Environment by file name.** `vitest.config.ts` has two projects: `*.test.tsx` runs in jsdom, every other test in node (like Workers). A test that needs a DOM is a `.test.tsx` file, never a per-file pragma. It aliases `virtual:react-router/server-build` to `test/support/server-build-stub.ts`.
- **Components** get a test only if they have behaviour (state, keyboard handling, focus, a callback): testing-library and `user-event`, through `renderWithRouter` and `renderRoutes` (`app/test/router.tsx`). Presentational components are covered by the smoke table and e2e. Never assert jsdom's lack of a browser behaviour as the behaviour.
- **The smoke table** (`app/routes/server-render.test.ts`): one row per route, rendered through the real `entry.server` and root against the fixture API, checking the status, the heading and what the browser gets before any JavaScript runs. It includes the outage (503) and malformed-body (502) pages. A new page adds a row here, not a test file.
- **Loaders and actions** run against msw (`app/test/msw.ts`): `serveFixtureApi()` serves the canned API for a test, and `fixtures.server.use(http.get(url, () => …))` makes one read fail. A request no handler answers is refused and fails the test. Helpers in `app/test/`: `loadContext()` (a validated env, API at `https://api.test`), `formRequest()`, `runAction()` for the `/api/*` proxy routes, `serveApp()` for header and nonce tests.
- **Helpers, server and theme code** are table-driven: one `it.each` of cases (`query-state.test.ts` lists each canonicalisation rule as `[why, page, query, canonical]`). `cookie-format.golden.test.ts`, the CSRF same-origin table and the Sentry "nothing about the reader is sent" test guard security and privacy: keep them.
- **Node versions.** The suite runs on `.nvmrc`'s Node 26.13.0. `app/test/setup.ts` gives inline elements a non-inline `display` so jsdom's accessible names keep the browser's word breaks.

## The canned fixture API

`test/fixture-api/` is the minimum the read pages need, not a re-implementation of the backend. `router.ts` routes a request to a canned answer (`catalogue-operations.ts`, `data.ts`): `getHealthz`, the seeded users' `getMe` and `updateMe`, and the catalogue reads. Two error rules only: an unknown entity is 404, and a `term` or `affiliation` that no listed term has is 400 (the "left out" notice). A request is signed in by the stub session's bearer, `Bearer auth0|fixture:<userId>`; anything else is 401.

- **Every body is checked against `api/openapi.yaml`** (`spec.ts`) before it is served. A fixture that breaks the contract throws instead of answering, so re-vendoring the spec (`npm run sync:api`) surfaces stale fixtures at once.
- The same router serves msw (unit tests) and HTTP (`npx tsx test/fixture-api/server.ts`: port 4010 or `$PORT`, `/healthz`), which Playwright and `npm run dev:fixtures` start. The data is invented: stage names only, never real people.

## Stub sign-in: three locks

e2e and `npm run dev:fixtures` sign in as fixture users without Auth0. `/auth/login?as=<userId>[&returnTo=/path]` sets a real `__Host-bt_session` whose access token is `fixture:<userId>`; without `?as` it shows a chooser. All three locks must open:

1. **Compile flag.** `__STUB_AUTH__` is true only in `e2e` and `development` builds, and `stub-auth.server.ts` is reached only through `if (__STUB_AUTH__) await import(...)` in the `/auth/login` loader. `check:prod-build` builds production and preview and fails if either contains the stub module, its marker or a fixture host.
2. **`AUTH_MODE=stub`** in the environment.
3. **A local host:** `localhost` or `127.0.0.1`.

If `AUTH_MODE=stub` reaches a build without the flag, it is ignored with a logged error and `/auth/login` goes to Auth0.

## e2e

`npm run test:e2e` builds the e2e build (`npm run build:e2e`) and runs `playwright test --project e2e`. Playwright starts the fixture API on port 4010, then serves the build with `wrangler dev` on 8788 (`playwright.config.ts`; bindings arrive as `--var`, among them `AUTH_MODE=stub`). Specs use `http://localhost:8788`, because Playwright only sends Secure cookies to `localhost` over HTTP. It is separate from `validate` because it needs Chromium; CI runs it as the `e2e` job.

- **`e2e/journeys.spec.ts`**: the read journeys (home and search, browse pieces with filters, a phone's filter drawer, no-JS forms, a piece, history, bards, categories/collections/events, help and 404, the theme) and the stubbed sign-in, rename in settings and log out.
- **`e2e/templates.spec.ts`**: one visit per page template: axe (WCAG 2.0–2.2 A/AA) at 1280 in the default theme with zero violations, and at 360 no sideways scroll.
- **`e2e/screenshots.spec.ts`**: on demand only, `npm run screenshots`: each template, light and dark, at 360 and 1280, into `e2e/screenshots/` (gitignored). Compare screenshots only from the Playwright image.
- A network guard (`e2e/support/test.ts`) fails a test on any request that leaves the machine; call `waitForHydration(page)` before a step that needs JS.
- **Workers are 4 and retries 1**: one `wrangler dev` serves every worker, and the CPU-count default drops requests; the retry covers wrangler's own restart flakes. Don't raise the workers without measuring. Don't build into `build/` while a run is going.
- **Fonts.** Layout depends on `system-ui`: CI's `e2e` job runs in the official Playwright image (pinned by digest in `ci.yml`, its tag equal to the locked `@playwright/test`), where it is WenQuanYi Zen Hei. Locally the layout checks should still pass.
