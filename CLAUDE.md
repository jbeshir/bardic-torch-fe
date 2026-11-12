# CLAUDE.md: bardic-torch-fe (React Router 8 on Cloudflare Workers)

Read [README.md](README.md) first for the concepts. The visual rules are in [docs/DESIGN.md](docs/DESIGN.md), the test layers in [docs/TESTING.md](docs/TESTING.md), and the deployment runbook in [docs/DEPLOY.md](docs/DEPLOY.md).

## Project rules

1. **Fix problems; never suppress them.** No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `prettier-ignore`. No new exclusions in the eslint, tsconfig, prettier, vitest or knip configs. (The one entry in `.prettierignore` is the vendored `api/openapi.yaml`.)
2. **Pin dependencies exactly.** Use `npm install --save-exact`, and commit `package-lock.json`. `npm ci` must work from a clean checkout. A package held below npm's `latest` needs a reason in the README ("Versions held back").
3. **Colour comes from tokens only.** No raw colours outside `app/styles/tokens.ts` and the files that mirror it (`tokens.css`, hand-written; `theme-colour.ts`; the favicon; the manifest). No Tailwind `dark:` and no arbitrary `[...]` values: add a named token or `@utility` in `tokens.css` instead. Every style must work in light and dark.
4. **No dead code.** No unused exports or re-exports, no TODO/FIXME, no half-wired features and no disabled placeholder UI. `knip` (`check:unused`, one pass) fails on any unused file, export or dependency; tests count as users, so it does not catch an export only a test uses. Names make sense from the current code alone. Data is immutable: readonly types, and never mutate props or loader data.
5. **Every API interaction has visible, meaningful error handling** in the UI. The API's `message` is not for display, so map its `code` (and status) to our own copy in `app/server/api.server.ts`.
6. **The API contract is vendored.** Never edit `api/openapi.yaml`. Update it with `npm run sync:api -- <path|url>`, which also regenerates `app/api/schema.gen.ts`, then fix the types and fixtures until `validate` passes.
7. **The browser never calls the API directly.** Reads happen in loaders. Writes are form posts that call `assertSameOrigin` first: the editors and Withdraw are plain document POSTs (`<Form method="post" reloadDocument>`) to their own route's action, and Settings uses the form-encoded `/api/*` proxy routes, which the browser sends with `sendForm` (`app/client/send-form.ts`): from a UI route's `clientAction` (Settings) or a plain `fetch` (the theme toggle), never a React Router fetcher aimed straight at a resource route, whose failed requests (a platform 503, no network) React Router throws to an error boundary instead of the form.
8. **Stub sign-in never reaches a real deployment.** It is reached only through `__STUB_AUTH__` inside `/auth/login`. Don't import `stub-auth.server.ts` anywhere else; `check:prod-build` enforces this.
9. **WCAG 2.2 AA.** Use semantic HTML and correct ARIA. Everything must be keyboard operable, focus must be visible and never hidden, targets must be at least 24 px (44 px for the primary controls on mobile), and pages must reflow at 320 px.
10. **Copy.** British spelling, sentence-case labels. **Links only, never lyrics.**
11. **Privacy.** The repository is public. Never commit anyone's legal name or raw data from the old wiki's dump. Fixture users have invented stage names only.
12. **Licence.** Help content adapted from the old wiki is CC BY-SA 4.0, and must stay attributed to its contributors (see `/help/licence`).
13. **Tests are proportionate** (docs/TESTING.md): component tests for components with behaviour; loaders and actions against msw with the canned, spec-checked fixture API; the server-render smoke table (one row per page); and the short e2e suite (journeys, axe once per template in the default theme, one 360 px reflow check). Screenshots are on demand: `npm run screenshots`.
14. **The config files stay loadable by Node.** `vite.config.ts`, `vitest.config.ts` and everything they import use `.ts` import specifiers and relative paths (no `~/` alias), and only erasable TypeScript (no enums or parameter properties), so Vite's native config loader raises no warning .

## Validation

`npm run validate` runs before every commit: `check:types` (the committed `Env` matches `wrangler.jsonc`), `gen:types` (React Router's route types), `format:check`, `lint`, `tsc`, `check:unused` (knip), `check:api` (generated types fresh), `test:run` (vitest) and `check:prod-build` (production and preview builds contain no stub sign-in).

- `npm run test:e2e` builds the e2e build and runs the Playwright journeys and template checks against the fixture API. It is outside `validate` because it needs Chromium. `npm run screenshots` takes the on-demand screenshots.
- `npm run audit` (`npm audit`) and `npm run audit:signatures` need the registry, so they are outside `validate`.

CI (`.github/workflows`): `ci.yml` runs the jobs `validate` and `e2e` on pull requests and on pushes to `main` and `preview` (`e2e` in the Playwright image, pinned by digest); `audit.yml` runs the `audit` job weekly and on pull requests to `main`. All three are required on `main`. Actions are pinned to a full commit SHA with the tag in a trailing comment, and every job installs npm 12.2.1 on the Node in `.nvmrc`. A new check goes in a `package.json` script and in `validate` (or `test:e2e`).

### Running e2e

- **Where layout is decided:** the Playwright image (`mcr.microsoft.com/playwright:v1.61.1-noble`, tag equal to the locked `@playwright/test`). Locally: `npx playwright install --with-deps chromium`, then `npm run test:e2e`; compare screenshots only from the image.
- **Sandboxes without browsers** use two images on one checkout: the **node** image (package-manager egress) runs `npm ci`; the Playwright **1.61.1 browser** image (no egress) runs `npm run test:e2e`. Neither has `.nvmrc`'s Node 26.13.0: run `sh /workspace/tools/install-node-lts.sh` once in the node image (the script lives outside the repo; it fetches Node 26.13.0 and npm 12.2.1 into `/workspace/tools`), then `. /workspace/tools/node-lts.env` in every shell, in both images.
- Filtered runs: `npm run test:e2e -- -g "settings"`.

### Manual checks

After `validate` passes, for a change that touches the UI:

- Both themes, explicit choice and system preference; forced colours for controls and states; no flash of the wrong theme.
- Keyboard alone: Tab order, Escape, focus return, focus never hidden; 200 % zoom and 320 px reflow; reduced motion.
- No JavaScript: navigation, the theme toggle, the drawer and the account menu still work.
- Every API call, when it fails (each 4xx code, 500, malformed body, network failure, expired session): meaningful copy and a way to recover.
- No duplicate definitions, unused fields or disconnected logic; British spelling, no legal names.
