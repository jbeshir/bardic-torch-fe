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
  - the one dependency override (`typescript`), one locked version of `@playwright/test`, `playwright` and `playwright-core`, and an `allowScripts` decision for every locked package with an install script (read from `package-lock.json`, so a version bump fails until it is decided again, and none is stale);
  - no e2e code makes its own Playwright `APIRequestContext`, and no link component takes a `target`;
  - the original wiki's host only in the allowed files;
  - `.prettierignore` holds exactly the expected entries;
  - the CI workflow, the ops files (`wrangler.toml`, `.dev.vars.example`, `worker-configuration.d.ts`, `public/_headers`, `public/_routes.json`) and these docs.
- `no-raw-colours.test.ts`: colour only from the tokens.
- `motion.test.ts`: movement only under `motion-safe:`.
- `lint-coverage.test.ts`: ESLint (`eslint.config.ts`) lints every code file (`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`: scripts and config files too) with the import rules at error, and every code file is in knip's project (`knip.json`), which checks unused files, exports and dependencies (`npm run check:unused`).
- `readonly-props.test.ts`: every component's props (and every hook's options object) are `readonly`.
- `component-usage.test.ts`, a second check after knip's: every export of an app module (components, server, schemas, constants, hooks, contexts, content; not the framework-read routes, root and entries, nor `app/test`) is imported by non-test code, not only by tests.

The scans walk the tree with one helper, `filesUnder` (`test/support/files.ts`), which skips the gitignored e2e screenshots.

It also runs the build checks `check:api`, `check:tokens`, `check:contrast` and `check:prod-build`. See CLAUDE.md for what each does.

## Deviation from the product plan (PLAN §9)

The product plan has `npm run validate` cover the Playwright suite too. In FE1 it doesn't. **`npm run test:e2e` is a separate command**, because it needs Chromium and two full builds. Validate stays runnable anywhere Node runs, including sandboxes without browsers.

CI runs both, and both jobs are required on `main`, so nothing merges without e2e. CLAUDE.md has the two-image recipe for sandboxes.

Other FE1 differences from the plan's test list follow from the real API (no revoked or expired tokens to show) and are recorded in the chunk summaries.

## Unit tests

- **Environment by file name only.** `vitest.config.ts` has two projects: `dom` runs `*.test.tsx` in jsdom, `node` runs every other test in node, like the Workers runtime. A test that needs a DOM is a `.test.tsx` file (e.g. `test/cut-off.test.tsx`), never a per-file pragma; `test/environments.test.ts` proves the split. vitest has its own config, so it never loads the Remix plugin.
- **The Node versions.** The suite runs on `.nvmrc`'s Node 26.13.0, and the migration gates also ran it on Node 22.23.3 and 24.17.0. Node ≥ 24's fetch (undici ≥ 7) rejects an `AbortSignal` that isn't its own, which broke every router navigation and submission under vitest 1's jsdom environment; vitest ≥ 4 gives jsdom Node's `AbortController`. `app/test/abort-signal.test.tsx` fails if that regresses: a `Request` takes the environment's signal, and a `<Form method="post">` submission reaches its action.
- **Accessible names in jsdom.** Testing Library's name algorithm trims every child element's text, and only separates children that aren't `display: inline`. jsdom 30 computes HTML's default `display`, so `Moods<span> (optional)</span>` would be named "Moods(optional)", which no browser does. `app/test/setup.ts` gives inline phrasing elements a non-inline display, which is how jsdom up to 29 behaved (it computed none), so names keep the browser's word breaks.
- **Components** use testing-library and `@testing-library/user-event`.
  - Test every state, and the keyboard.
  - `expectSameMarkupInBothThemes` in `app/test/themes.ts` is a **guard, not theme coverage**: it fails only if a component starts branching on the theme. It says nothing about how either theme looks. The theme evidence is `check:contrast` (every token pair in both themes) and the e2e checkpoints (axe and screenshots in both themes, each asserting that the page paints that theme).
  - `renderWithRouter` and `renderRoutes` (`app/test/router.tsx`) supply Remix's router context.
- **Loaders and actions** run against the fixture API through msw:

  ```ts
  import { serveFixtureApi } from "~/test/msw";
  import { loadContext, sessionCookie, sessionTokens } from "~/test/context";

  const api = serveFixtureApi(); // fresh fixture state per test

  const cookie = await sessionCookie(
    sessionTokens({ accessToken: "fixture:contributor" })
  );
  ```
  - **Every msw server comes from `serveMocks()`** (`app/test/msw.ts`; `serveFixtureApi()` uses it). msw 3 imports `http`/`HttpResponse` from `msw/http` and `delay` from `msw/utils/delay`. A request no handler answers (msw's `onUnhandledFrame`) is refused **and fails the test** that made it, so a test can't pass because the code under test turned msw's refusal into a 502. `server.use()` adds one test's handlers, e.g. a fake Auth0 token endpoint answering with Auth0's real response shapes.
  - `loadContext()` gives a validated env whose API base URL is `https://api.test`.
  - `formRequest()` builds a same-origin, form-encoded request.
  - `runAction()` (`app/test/proxy.ts`) runs a proxy action.
  - `serveApp()` (`app/test/server-build.ts`) renders routes through the real `entry.server` for header and nonce tests.

- **Sentry (R28):** `app/contexts/SentryContext.test.tsx` mocks `@sentry/remix`: no init without a DSN, one init with it across navigations, and an error page that is the first render starts Sentry before reporting. `app/entry.server.test.ts` mocks `@sentry/cloudflare`: loader and render errors are reported (abandoned requests are not), and `sentry.server.test.ts` checks the server gets no DSN when `SENTRY_DSN` is unset or empty. Delivery to a real Sentry is not part of any test run.
- **Cookie bytes:** `app/server/cookie-format.golden.test.ts` pins the exact `Set-Cookie` strings of `__Host-bt_session` and `__Host-bt_return_to` for a fixed secret and payload, and parses them back. Its expected strings are golden: a library change that alters them would sign every reader out, so fix the code, never the strings.
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

- **Idle keep-alive sockets stay open.** The server sets `keepAliveTimeout = 0`, so only the client ever ends a keep-alive connection. With Node's default (5 s, plus a 1 s buffer) a client whose event loop runs late, such as a Playwright worker busy with axe and full-page screenshots, or workerd, can send on a socket the server has just closed, and gets `ECONNRESET` ("socket hang up"); a repro with a starved client failed 4/4 with the default and 0/4 with 0. `test/contract/server.test.ts` checks the setting, and that a second request on one socket after 6.5 s idle is answered (about 7 s). Retries would only hide it. The other hop, Playwright to `wrangler pages dev` on 8788, is still exposed: wrangler 3.57's server closes an idle keep-alive socket after about 5 s and sends no `Keep-Alive` hint, and has no setting for it. `test/repo-hygiene.test.ts` checks that every e2e API request uses the per-test `request` fixture or `page.request`, never an API context of its own. Which hop the original "socket hang up" came from is unknown: no trace of it exists, and the FE1 baseline run had none.
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

**How each phase is served.** Playwright starts the fixture API on port 4010, then the phase's build under `wrangler pages dev build/client` on `127.0.0.1:8788`. It passes an explicit `--compatibility-date` and `--compatibility-flags=nodejs_als` (the same as `wrangler.toml`, which a hygiene test checks), `AUTH0_DOMAIN=auth0.invalid` and `AUTH_MODE=stub`. No phase sets `SENTRY_DSN`. Specs use `http://localhost:8788`, because Playwright's request context only sends Secure cookies over plain HTTP to `localhost`.

**Projects.** Each phase has two:

- `<phase>`: every spec except `no-js.spec.ts`;
- `<phase>-no-js`: `no-js.spec.ts` with JavaScript off for the whole context.

Both are followed by the `screenshots` teardown project.

**Network isolation.** Every spec imports `test` from `e2e/support/test.ts`. Its automatic network guard aborts, and fails the test on, any request to a host other than this machine. Chromium also gets a host-resolver rule that resolves nothing else. A test that expects a redirect off the machine (logout to Auth0) names the host in `offHostRedirects` and asserts that hop itself. The suite never needs network access or secrets.

**Workers, retries and timeouts.** There are 4 workers (see CLAUDE.md for why), a 90 s test timeout and a 15 s `expect` timeout. Each test gets **one retry**, for the dev runtime's own flakes: `wrangler pages dev` answers a POST or PATCH that was in flight when its workerd restarted with a 503 ("Your worker restarted mid-request"; it retries GETs itself). A test that passes only on its retry is _flaky_. `scripts/e2e.mjs` reads each phase's JSON report (`playwright-report/<phase>.json`) and prints every flaky test by name in a banner after the phase and again at the end, so a retry is never silent. Treat a flaky test as a bug to look into. The server runs with `--live-reload=false`. wrangler 3.57 has no switch for its own file watching (esbuild watch of the Functions bundle and a watch of `functions/`), but nothing writes those files during a run, and the logs show no rebuild. Don't build into `build/` or edit `functions/` while a run is going. Call `waitForHydration(page)` (`e2e/support/hydration.ts`) before any step that needs JS behaviour.

### Checkpoints and screenshots

`checkpoint(page, name, options?)` (`e2e/support/journey.ts`) is the visual and accessibility gate for a page or state:

- **axe** with tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa, in light and dark, at 360 and 1280 px. There must be zero violations.
- **Six PNGs** in `e2e/screenshots/`, named `{journey}-{checkpoint}-{light|dark}-{360x800|768x1024|1280x800}.png`. They are full-page unless `viewportOnly`. A state only one theme can reach is captured in that theme only: `checkpointThemes` in `checkpoints.ts` lists them (today just `theme/dark-choice`, dark).
- Before each capture it asserts that the page paints that theme's `canvas` token, so both-theme evidence is real. It also moves the pointer to the corner, so no hover is left over (hover is not captured; DESIGN §10.6).
- Full-page captures are taken scrolled to the top, so the sticky header is drawn at the top, not over the field a test scrolled to.
- Fraunces is `font-display: optional`, so a cold page load can keep the fallback serif. Before capturing, the checkpoint adds the same Fraunces files again from JS with `display: block` and waits for `document.fonts.ready`, so every capture shows the design face.
- **The sans in the captures is the image's `system-ui`.** In the Playwright browser image that resolves to WenQuanYi Zen Hei, a single Regular face, and Chromium neither has nor synthesises a bold for it. Labels, legends, alert titles, `h4` and `**bold**` therefore render at regular weight in the screenshots. This is the image's fonts, not our CSS: `font-synthesis` is only turned off for Fraunces, and the same CSS renders real bold with any system sans that has one (Liberation Sans in the same image: 286 → 312 px for one string at 400 → 700).

**Forced colours.** `e2e/stub/forced-colours.spec.ts` emulates `forced-colors: active` and focuses, from the keyboard, the three elements that hide the browser's outline (`focus-visible:outline-none`): a card's link, the main content after a client navigation, and an error page's heading. It asserts the outline is still drawn, and takes a checkpoint of each (journey `forced-colours`), in both themes as usual. axe runs with forced colours turned off for its pass (`inAuthorColours` in `e2e/support/journey.ts`): Chromium paints the system palette but `getComputedStyle` reports the author `color` next to the forced `background-color`, and axe has no forced-colours mode, so its contrast rule would pair colours that are never painted together. The screenshots are taken in forced colours.

`target: "<selector>"` limits axe and the screenshot to one element, such as a styleguide block. The sticky header and the app bar are hidden during that capture, so they are never painted over it. The element is scrolled to the top of the viewport, which is made taller if the element still doesn't fit (Chromium paints anything beyond the viewport as bare canvas), and the capture has 8 px of room around it so an outset focus ring shows whole. With `target` and `viewportOnly`, axe covers the element and the screenshot is the viewport. Use this for an open dialog with its scrim, or toasts in place. `atEachViewport` rebuilds a width-specific state (the account panel, the drawer) at each width.

Every checkpoint is declared per phase and journey in `e2e/support/checkpoints.ts`; the journey is the spec file name. `checkpoint()` refuses undeclared names. On a full run, the `screenshots` teardown (`e2e/global-teardown.ts`) fails unless the screenshot directory holds exactly the declared set: every checkpoint × 6, nothing undeclared, and no name in both phases. Filtered runs skip that check.

The layout sweep (`e2e/support/journey-pages.ts`, run by `e2e/{prod,stub}/sweeps.spec.ts`) checks every page a reader can land on for:

- horizontal overflow at 360 and 320 px;
- 24 px targets (WCAG 2.5.8) at 360 and 1280 px. An undersized target fails if the 24 px circle on its centre touches another target, or another undersized target's circle. Only an inline link in a sentence (its block has text of its own) is exempt. With a modal dialog open only its contents count. Open states (drawer, account panels, token reveal, form errors, dialogs) call `expectTargetSizesAtLeast24(page, widths)` themselves;
- focus never hidden (WCAG 2.4.11, AA: not _entirely_ hidden) at the page's width and at 360. The Tab walk fails if it hasn't come back to its first stop in 400 stops, so nothing goes unchecked. The hit test sees toasts, which take pointer events;
- 44 px primary controls at 360.

`e2e/support/layout.ts` also has `expectNoLayoutShift` for CLS. `e2e/support/text-spacing.ts` applies the WCAG 1.4.12 override and checks that nothing is clipped. It runs on the styleguide and on the shell: the app bar, the header at md and lg, both account panels, and help prose (`stub/navigation.spec.ts`). The same spec checks forced colours on the shell (focus on the current sidebar item and the pressed theme button changes the outline, and button links keep an edge).

### Adding a journey

1. **Put the spec in the right phase.** Use `e2e/prod/<journey>.spec.ts` if the page works in the production build. Use `e2e/stub/` if it needs sign-in or the styleguide. Import `test` from `../support/test` and `expect` from `@playwright/test`.
2. **Make the data you need.** Create a fresh fixture user with `createFixtureUser(request, {...})` and sign in with `page.goto("/auth/login?as=<id>&returnTo=/path")`. Inject failures with `failNext`. Never rely on another test's state.
3. **Wait for hydration** with `waitForHydration(page)` before clicking or typing anything that needs JS.
4. **Declare a checkpoint** for each new page or key state in `e2e/support/checkpoints.ts`, and call `checkpoint(page, "<name>")` in its own test. A checkpoint is slow, so keep other sweeps out of that test.
5. **Sweep new pages.** A new page a reader can land on also gets a row in `JOURNEY_PAGES` (`e2e/support/journey-pages.ts`) with its primary controls.
6. **No-JS behaviour** goes in that phase's `no-js.spec.ts`. Don't use `test.use({ javaScriptEnabled: false })` anywhere else.
7. **Run it filtered**, e.g. `npm run test:e2e -- e2e/stub/<journey>.spec.ts`, then run the full suite once so the teardown checks the screenshot set.
