# CLAUDE.md: bardic-torch-fe (Remix on Cloudflare Pages)

Read [README.md](README.md) first for the concepts. The visual rules are in [docs/DESIGN.md](docs/DESIGN.md), the test layers in [docs/TESTING.md](docs/TESTING.md), and the deployment runbook in [docs/DEPLOY.md](docs/DEPLOY.md).

## Project rules

1. **Fix problems; never suppress them.** No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `prettier-ignore`. No new exclusions in the eslint, tsconfig, prettier or vitest configs. (The one entry in `.prettierignore` is the vendored `api/openapi.yaml`.)
2. **Pin dependencies exactly.** Use `npm install --save-exact`, and commit `package-lock.json`. `npm ci` must work from a clean checkout.
3. **Colour comes from tokens only.** No raw colours outside `app/styles/tokens.ts` and the files generated from it. No Tailwind `dark:` and no arbitrary `[...]` values: add a named config value instead. Every style must work in light and dark.
4. **No dead code.** No unused exports or re-exports, no TODO/FIXME, no half-wired features and no disabled placeholder UI. Every export is used by app code, not only by tests (`import/no-unused-modules` is an error, and `test/component-usage.test.ts` checks every app module, because ESLint counts test imports as uses). Names make sense from the current code alone. Data is immutable: readonly types (props too: `test/readonly-props.test.ts`), and never mutate props or loader data.
5. **Every API interaction has visible, meaningful error handling** in the UI. The API's `message` is not for display, so map its `code` (and status) to our own copy in `app/server/api.server.ts`.
6. **The API contract is vendored.** Never edit `api/openapi.yaml`. Update it with `npm run sync:api -- <path|url>`, which also regenerates `app/api/schema.gen.ts`, then fix the zod schemas and fixtures until `validate` passes.
7. **The browser never calls the API directly.** Reads happen in loaders. Writes go through the form-encoded `/api/*` proxy routes, which call `assertSameOrigin`. The browser sends them with `sendForm` (`app/client/send-form.ts`): from a UI route's `clientAction` (Settings) or a plain `fetch` (the theme toggle), never a Remix fetcher aimed straight at a resource route, whose failed requests (a platform 503, no network) Remix throws to an error boundary instead of the form.
8. **Stub sign-in never reaches a real deployment.** It is reached only through `__STUB_AUTH__` inside `/auth/login`. Don't import `stub-auth.server.ts` anywhere else; `check:prod-build` enforces this.
9. **WCAG 2.2 AA.** Use semantic HTML and correct ARIA. Everything must be keyboard operable, focus must be visible and never hidden, targets must be at least 24 px (44 px for the primary controls on mobile), and pages must reflow at 320 px.
10. **Copy.** British spelling, sentence-case labels. **Links only, never lyrics.**
11. **Privacy.** The repository is public. Never commit anyone's legal name or raw data from the old wiki's dump. Fixture users have invented stage names only.
12. **Licence.** Help content adapted from the old wiki is CC BY-SA 4.0, and must stay attributed to its contributors (see `/help/licence`).
13. **Tests come with the change** (vitest + testing-library):
    - every component, in all its states, in both themes, with the keyboard;
    - every loader and action, against msw;
    - every helper.

    New pages and states also get e2e checkpoints (see docs/TESTING.md).

## Validation

Run these automated checks before every commit:

- `npm run validate` runs, in order: `format:check`, `lint`, `typecheck`, `check:api` (generated types fresh), `check:tokens` (generated token files fresh), `check:contrast` (every contrast pair in DESIGN), `test:run` (all vitest: unit, contract and repo scans) and `check:prod-build` (production and preview builds contain no stub sign-in; the styleguide only in preview).
- `npm run test:e2e` runs Playwright: the **prod** phase (`npm run build`), then the **stub** phase (`npm run build:e2e`). Each is served by `wrangler pages dev` against the fixture API. It is separate from `validate` because it needs Chromium.

CI (`.github/workflows/ci.yml`) runs both as the required jobs `validate` and `e2e`. A new check must be added to a `package.json` script, to the `validate` chain (or to `test:e2e`), and to CI if it needs its own step.

### The e2e recipe

- **Locally:** `npm ci`, then `npx playwright install --with-deps chromium` once, then `npm run test:e2e`.
- **In sandboxes without browsers** (e.g. demesne), split it across two images on the same checkout:
  1. the **node** image, with package-manager egress, runs `npm ci`;
  2. the Playwright **1.61.1 browser** image, with no egress, runs `npm run test:e2e`.

  The browser image's Playwright version must match the locked `@playwright/test` (1.61.1).

- **Filtered runs:** `npm run test:e2e -- <playwright args>` (e.g. `-g "settings"`) runs both phases filtered, and skips the screenshot completeness check.
- **Workers are fixed at 4.** One `wrangler pages dev` (a single workerd) serves every worker, and each worker runs axe and full-page screenshots. With the CPU-count default, workerd drops requests and checkpoints time out; four keeps runs stable. Don't raise it without measuring.
- **Output** (all gitignored): screenshots in `e2e/screenshots/`, reports in `playwright-report/<phase>/`, traces in `test-results/<phase>/`.

### Manual quality checks

After the automated checks pass, review the change for these:

1. **Duplicate code.** Repeated constants, types or helpers that should be one definition, e.g. copy constants from `~/schemas/rules` such as `DISPLAY_NAME_RULE`.
2. **Incomplete or disconnected logic.**
   - Legacy mechanisms left in place.
   - Closures over stale data.
   - Fields that are never read or written.
   - Functions that are never called.
   - Data that never reaches the UI.
   - Features that aren't wired up.
3. **Validation coverage.** Any new check is in `package.json`, in `validate` (or `test:e2e`), and in CI.
4. **Redundant fields or parameters.**
   - Values that can be derived from other values.
   - Methods used only by tests.
   - Re-exports.
   - Unused exports, which must be fixed, not ignored.
5. **Theming.**
   - Check every new style in light and in dark, with an explicit choice and with the system preference.
   - Token classes only.
   - Check it in forced colours for controls and states.
   - Make sure the server-rendered `data-theme` still prevents a flash.
6. **Error handling.** For every API call or server interaction, trace what happens when it fails:
   - a 4xx with each code the spec allows;
   - a 500;
   - a malformed body (502);
   - a network failure;
   - an expired session (401 clears it).

   Does the UI show something meaningful in each case, with a way to recover? Or does it go blank, break, or fail silently?

7. **Accessibility.**
   - Use the keyboard alone: Tab order, Escape, focus return after dialogs and drawers, focus never hidden by the header or the app bar.
   - Use a screen reader for names, roles, live regions and `aria-current`.
   - Check 200% zoom and 320 px reflow, target sizes, reduced motion, and text spacing.
   - axe in e2e catches only part of this.
8. **No JavaScript.**
   - Navigation, the theme toggle, the drawer and the account menu must still work.
   - Settings must show its notice.
9. **Copy and privacy.** British spelling, sentence case, links only, no legal names, attribution kept.
