# Testing

Tests come in three layers:

| layer    | what it covers                                                                    | where                                                                      | command                            |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| unit     | components, hooks, helpers, server modules, loaders and actions                   | next to the code, `app/**/*.test.{ts,tsx}`; scripts in `scripts/*.test.ts` | `npm run test:run` (in `validate`) |
| contract | the vendored spec, the generated types and the fixture API                        | `test/contract/`                                                           | `npm run test:run` (in `validate`) |
| e2e      | the built app in Chromium, served by `wrangler pages dev` against the fixture API | `e2e/`                                                                     | `npm run test:e2e`                 |

`npm run validate` also runs these repository scans, all as vitest tests in `test/`:

- `repo-hygiene.test.ts`:
  - exact pins and no feed leftovers;
  - the original wiki's host only in the allowed files;
  - the CI workflow, the ops files (`wrangler.toml`, `.dev.vars.example`, `worker-configuration.d.ts`, `public/_headers`, `public/_routes.json`) and these docs.
- `no-raw-colours.test.ts`: colour only from the tokens.
- `motion.test.ts`: movement only under `motion-safe:`.
- `component-usage.test.ts`: every component export is used by app code.

It also runs the build checks `check:api`, `check:tokens`, `check:contrast` and `check:prod-build`. See CLAUDE.md for what each does.

## Deviation from the product plan (PLAN §9)

The product plan has `npm run validate` cover the Playwright suite too. In FE1 it doesn't. **`npm run test:e2e` is a separate command**, because it needs Chromium and two full builds. Validate stays runnable anywhere Node runs, including sandboxes without browsers.

CI runs both, and both jobs are required on `main`, so nothing merges without e2e. CLAUDE.md has the two-image recipe for sandboxes.

Other FE1 differences from the plan's test list follow from the real API (no revoked or expired tokens to show) and are recorded in the chunk summaries.

## Unit tests

- **Environment by file name.** `*.test.tsx` runs in jsdom; everything else runs in node, like the Workers runtime. A `.ts` test that needs a DOM says so with `// @vitest-environment jsdom`.
- **Components** use testing-library and `@testing-library/user-event`.
  - Test every state, and the keyboard.
  - Test both themes: `expectSameMarkupInBothThemes` in `app/test/themes.ts` checks that a component's markup doesn't depend on the theme, because the colour is all in the token CSS.
  - `renderWithRouter` and `renderRoutes` (`app/test/router.tsx`) supply Remix's router context.
- **Loaders and actions** run against the fixture API through msw:

  ```ts
  import { serveFixtureApi } from "~/test/msw";
  import { loadContext, sessionCookie, sessionUser } from "~/test/context";

  const api = serveFixtureApi(); // fresh fixture state per test; unhandled requests fail

  const cookie = await sessionCookie(
    sessionUser({ accessToken: "fixture:contributor" })
  );
  ```
  - `loadContext()` gives a validated env whose API base URL is `https://api.test`.
  - `formRequest()` builds a same-origin, form-encoded request.
  - `runAction()` (`app/test/proxy.ts`) runs a proxy action.
  - `serveApp()` (`app/test/server-build.ts`) renders routes through the real `entry.server` for header and nonce tests.

- **Markdown help pages:** `compileMarkdown` and `FRONTMATTER` (`app/test/markdown.ts`) compile with the real pipeline.

## The fixture API

`test/fixture-api/` is a fake of the backend for the FE1 operations: `getMe`, `updateMe`, `listAPITokens`, `createAPIToken`, `revokeAPIToken`, plus `getHealthz` for readiness.

- **One operation table, three transports.** `operations.ts` is keyed by `operationId`, and `router.ts` routes requests to it. The same router serves:
  - msw in unit tests (`app/test/msw.ts`);
  - the Node server in e2e and `dev:fixtures` (`server.ts`, `npx tsx test/fixture-api/server.ts`, on `127.0.0.1:$PORT`, default 4010);
  - the contract scenarios.
- **It mirrors the backend's rules:**
  - display names are NFC-normalised and trimmed, 1–64 characters, with no control or format characters;
  - token names are at most 128 characters;
  - a user may have at most 10 active tokens (409 `token_limit_reached`);
  - the token list is active only, newest first;
  - non-JSON bodies get 415 and bodies over 16 KiB get 413.
- **It is checked against the contract.** Every response is validated against `api/openapi.yaml` (ajv, draft 2020-12) before it is returned. A fixture that breaks the contract throws, and the server answers 500.
- **State is per user.** Only `Authorization: Bearer auth0|fixture:<userId>` authenticates; a stub session's access token is `fixture:<userId>`. Anything else gets 401 `unauthenticated`. The seed users are `contributor` ("Morwen of the Marches") and `moderator` ("Master Tobias Fiddler"). They are invented stage names, as every fixture name must be.
- **Control endpoints** (Node server and msw):
  - `POST /__fixtures/users {role?, display_name?, tokens?: "sample" | "none", blocked?}` → 201 `{id}`. This creates an isolated user. A blocked user gets 403 `user_blocked` from every operation.
  - `POST /__fixtures/fail {userId?, operationId, status, code?, times?}` → 204. The next `times` (default 1) calls fail with that status and code. Only pairs the spec allows for the operation are accepted.

  In e2e use `createFixtureUser(request, options)` and `failNext(request, {...})` from `e2e/support/fixture-api.ts`.

- **Contract tests.** `test/contract/scenarios.ts` lists at least one success and one error per operation. They run through the router (`fixtures.test.ts`), over HTTP (`server.test.ts`) and through msw (`app/test/msw.test.ts`). `spec.test.ts` checks that the spec is valid OpenAPI 3.1 and has the FE1 operations; `generated-types.test.ts` pins the generated types FE1 relies on.

## Stub sign-in: three locks

e2e and `npm run dev:fixtures` sign in as fixture users without Auth0. `/auth/login?as=<userId>[&returnTo=/path]` sets a real `__Host-bt_session` whose access token is `fixture:<userId>`. Without `?as`, it shows a fixture-user chooser.

All three locks must open:

1. **Compile flag.** `__STUB_AUTH__` is true only in `e2e` and `development` builds. `app/server/stub-auth.server.ts` is reached only through `if (__STUB_AUTH__) await import(...)` inside the `/auth/login` loader. `check:prod-build` builds production and preview, and fails if either contains the stub module, its marker, or a fixture host.
2. **`AUTH_MODE=stub`** in the environment.
3. **A local host.** The request's host must be `localhost` or `127.0.0.1`.

If `AUTH_MODE=stub` reaches a build without the flag, it is ignored with a logged error, and `/auth/login` goes to Auth0. The prod e2e phase binds `AUTH_MODE=stub` on purpose to prove this ("AUTH_MODE=stub is ignored: /auth/login goes to Auth0").

## e2e

`npm run test:e2e` (`scripts/e2e.mjs`) runs two **phases**, one after the other, because both builds write `build/`:

- **prod**: `npm run build`, the real production build. Specs are in `e2e/prod/`: landing, help, theme, security headers and CSP, errors, signed-out settings, stub ignored.
- **stub**: `npm run build:e2e`. Specs are in `e2e/stub/`: sign-in, account and settings, navigation, errors, the styleguide.

Both phases always run. The command fails if either one does.

**How each phase is served.** Playwright starts the fixture API on port 4010, then the phase's build under `wrangler pages dev build/client` on `127.0.0.1:8788`. It passes an explicit `--compatibility-date` (the same as `wrangler.toml`), `AUTH0_DOMAIN=auth0.invalid` and `AUTH_MODE=stub`. Specs use `http://localhost:8788`, because Playwright's request context only sends Secure cookies over plain HTTP to `localhost`.

**Projects.** Each phase has two:

- `<phase>`: every spec except `no-js.spec.ts`;
- `<phase>-no-js`: `no-js.spec.ts` with JavaScript off for the whole context.

Both are followed by the `screenshots` teardown project.

**Network isolation.** Every spec imports `test` from `e2e/support/test.ts`. Its automatic network guard aborts, and fails the test on, any request to a host other than this machine. Chromium also gets a host-resolver rule that resolves nothing else. A test that expects a redirect off the machine (logout to Auth0) names the host in `offHostRedirects` and asserts that hop itself. The suite never needs network access or secrets.

**Workers and timeouts.** There are 4 workers (see CLAUDE.md for why), a 90 s test timeout and a 15 s `expect` timeout. Call `waitForHydration(page)` (`e2e/support/hydration.ts`) before any step that needs JS behaviour.

### Checkpoints and screenshots

`checkpoint(page, name, options?)` (`e2e/support/journey.ts`) is the visual and accessibility gate for a page or state:

- **axe** with tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa, in light and dark, at 360 and 1280 px. There must be zero violations.
- **Six PNGs** in `e2e/screenshots/`, named `{journey}-{checkpoint}-{light|dark}-{360x800|768x1024|1280x800}.png`. They are full-page unless `viewportOnly`.

`target: "<selector>"` limits axe and the screenshot to one element, such as a styleguide block or an open dialog. `atEachViewport` rebuilds a width-specific state (the account panel, the drawer) at each width.

Every checkpoint is declared per phase and journey in `e2e/support/checkpoints.ts`; the journey is the spec file name. `checkpoint()` refuses undeclared names. On a full run, the `screenshots` teardown (`e2e/global-teardown.ts`) fails unless the screenshot directory holds exactly the declared set: every checkpoint × 6, nothing undeclared, and no name in both phases. Filtered runs skip that check.

The layout sweep (`e2e/support/journey-pages.ts`, run by `e2e/{prod,stub}/sweeps.spec.ts`) checks every page a reader can land on for:

- horizontal overflow at 360 and 320 px;
- 24 px targets (WCAG 2.5.8);
- focus never hidden (WCAG 2.4.11) at the page's width and at 360;
- 44 px primary controls at 360.

`e2e/support/layout.ts` also has `expectNoLayoutShift` for CLS.

### Adding a journey

1. **Put the spec in the right phase.** Use `e2e/prod/<journey>.spec.ts` if the page works in the production build. Use `e2e/stub/` if it needs sign-in or the styleguide. Import `test` from `../support/test` and `expect` from `@playwright/test`.
2. **Make the data you need.** Create a fresh fixture user with `createFixtureUser(request, {...})` and sign in with `page.goto("/auth/login?as=<id>&returnTo=/path")`. Inject failures with `failNext`. Never rely on another test's state.
3. **Wait for hydration** with `waitForHydration(page)` before clicking or typing anything that needs JS.
4. **Declare a checkpoint** for each new page or key state in `e2e/support/checkpoints.ts`, and call `checkpoint(page, "<name>")` in its own test. A checkpoint is slow, so keep other sweeps out of that test.
5. **Sweep new pages.** A new page a reader can land on also gets a row in `JOURNEY_PAGES` (`e2e/support/journey-pages.ts`) with its primary controls.
6. **No-JS behaviour** goes in that phase's `no-js.spec.ts`. Don't use `test.use({ javaScriptEnabled: false })` anywhere else.
7. **Run it filtered**, e.g. `npm run test:e2e -- e2e/stub/<journey>.spec.ts`, then run the full suite once so the teardown checks the screenshot set.
