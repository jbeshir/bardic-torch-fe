# Bardic Torch design system

**Status:** v3, for milestone FE2 (the read UI). v2 (FE1, the foundation) folded in the design critique (items D1–D32) and aligned routes and names with the FE1 plan; v3 marks what FE2 built and adds the catalogue's components and page templates (§6.28–§6.30, §10.7–§10.16). **Owner:** product design. **Applies to:** `bardic-torch-fe` (React Router 8, Tailwind 4, Cloudflare Workers).

This is the reference for every visual and interaction decision in the frontend. Where it gives a value, use that value. Where it says MUST, a reviewer will check it. If something you need isn't covered, add it here in the same PR as the code. Don't improvise in a component.

**Milestone tags.** Every component (§6) and pattern (§7) carries one of these tags:

| Tag                      | Meaning                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE1**                  | Built, tested and wired into FE1 pages.                                                                                                                                                                                |
| **SG** (styleguide-only) | Built and tested in FE1 and shown on `/styleguide` in every state, but not wired into any FE1 page. The brief requires the component library, so these exist. Page-level wiring waits for the milestone that needs it. |
| **FE2**                  | Built, tested and wired into the catalogue's pages in FE2 (the read UI). A component tagged FE2 that was specified in FE1 as FE2+ is now built.                                                                        |
| **FE2+**                 | Specified here for later milestones (FE3 editing and after). It is **not** built yet. Building it early would be a half-wired feature.                                                                                 |

A component tagged FE1 or FE2 can still have individual states or variants tagged SG or FE2+. Those are marked inline.

**Routes.** FE1: `/`, `/help`, `/help/contributing`, `/help/faq-for-bards`, `/help/bard-preference-checklist`, `/help/conservation-status`, `/help/licence`, `/settings`, `/auth/login`, `/auth/callback`, `/auth/logout` (POST), `/resources/theme` (POST), `/api/me` (PATCH), `/api/tokens` (POST), `/api/tokens/:tokenId` (DELETE), `/styleguide` (not in production builds), and a catch-all 404. FE2 adds the catalogue's reads: `/pieces`, `/search`, `/bards`, `/categories`, `/collections`, `/events`, each entity's page (`/pieces/:slug`, `/bards/:slug`, `/categories/:slug`, `/collections/:id`, `/events/:slug`) with its `…/history`, `/revisions/:id`, `/robots.txt`, `/sitemap.xml` and `/sitemap/:type`. There is still **no** `/contact` or `/login` route, no flash messages, no dismissible banners, no confirm routes, no `/` keyboard shortcut and no toast actions. Catalogue links and the header search are on this site; the original wiki is linked only from the help pages' attribution, the footer and the 404 page, through `app/constants/navigation.ts` (§5.3).

**The brief:** _looks like a wiki, but modern and lovely._ People should recognise the wiki layout straight away: a page title with a rule under it, Read / Edit / History tabs, a left nav, a right infobox and category chips at the bottom. That familiarity tells them editing is allowed. The finish should be warm and crafted: firelight, vellum, iron-gall ink and lapis, used with restraint. Light and dark are both first-class designs.

---

## 1. Principles

1. **An index, not an archive.** Bardic Torch points to where works live and never hosts them. _So we_ style outbound links as the main content (link lists, "where to find it" sections). They are never buried, and every external link is marked as external.
2. **Editing is allowed, and it looks that way.** _So we_ show the Edit tab on every editable page, even to signed-out readers (it leads to sign-in and then back), and we write the pending-approval state as a normal step rather than as a warning. (FE1 has no editable pages. Editing arrives with FE3, and FE1 pages say how to contribute instead.)
3. **Familiar wiki layout, contemporary finish.** _So we_ keep the wiki's layout (title and rule, tabs, left nav, infobox, categories) but use generous spacing, soft radii, a warm palette and a single serif display face. We never copy MediaWiki chrome: no blue-grey gradients and no boxy tab outlines.
4. **The torch lights the way and doesn't set the page on fire.** Amber is the accent. _So we_ keep it for the logo, the primary action, the current tab and current nav item, focus-adjacent marks and the infobox cap, and we keep it to less than about 5 % of any screen. List bullets, blockquote rules and `hr` ornaments are **not** amber (§3.3). Body text is always ink on vellum, or vellum on charcoal.
5. **Legible first, beautiful second, and both together.** _So we_ use system sans for body and UI text, measure prose at about 68 characters, make every text pair at least 4.5:1 and every meaningful non-text element at least 3:1, and never convey state by colour alone (every status has an icon and a word).
6. **Dark is its own design.** _So we_ design dark mode as warm charcoal lit by firelight. It is never an inversion. Saturation is reduced, elevation comes from lighter surfaces rather than shadows, and every component is screenshot-reviewed in both themes.
7. **Works for everyone, everywhere.** It must work from 360 px wide, work without JavaScript, and respect reduced motion. _So we_ build every control as a real link or form first, enhance it with JS second, and make primary touch targets 44 × 44 px.

---

## 2. Colour

### 2.1 Mechanism (fixed)

- **One source of truth:** `app/styles/tokens.ts` holds every colour for both themes, plus the other token groups (type scale, radii, shadows, motion, layout sizes). It is the only hand-written file in the repo that contains colour literals.
- `scripts/build-tokens.mjs` (`npm run gen:tokens`) generates, from that module:
  - `app/styles/tokens.css`: the CSS custom properties;
  - `public/favicon.svg` (§5.9);
  - `public/site.webmanifest` (`theme_color` and `background_color` = `canvas`);
  - `app/styles/theme-colour.gen.ts`: the `<meta name="theme-color">` values, which `root.tsx` imports.
- Every generated file starts with an `@generated` header naming the generator. `npm run check:tokens` (part of `validate`) fails if any generated file differs from what the generator would write now.
- Colour tokens are CSS custom properties holding **space-separated RGB channels** (for example, `--bt-fg: 43 33 24`). The generated Tailwind theme reads them as `rgb(var(--bt-fg))`, and a colour at an alpha is a named utility that writes `rgb(var(--bt-fg) / 0.1)` (Appendix A). The variables carry a `--bt-` prefix so they don't clash with Tailwind's own theme variables (`--color-*`, `--text-*`, `--shadow-*`).
- `tokens.css` has three colour blocks, all generated from the same two maps:
  - `:root, [data-theme="light"]` holds the light values and `color-scheme: light`.
  - `:root[data-theme="dark"], [data-theme="dark"]` holds the dark values and `color-scheme: dark`.
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` holds the dark values and `color-scheme: dark`.
  - Because the blocks also match `[data-theme]` on any element, a wrapper can force a theme for its subtree (the styleguide previews do this). A `[data-theme="light"]` wrapper under an OS-dark page resolves to the light tokens, because the wrapper declares them itself.
- Components use semantic classes only, for example `bg-surface`, `text-fg-muted`, `border-border-strong`, `text-link` and `bg-accent`.
- **Tailwind's palette doesn't exist here.** The generated `@theme` starts with `--*: initial`, which clears every Tailwind default, and then defines `transparent`, `current`, `inherit` and the tokens as colours. So `bg-amber-600` and `text-white` don't compile to anything.
- **No arbitrary values** (`bg-[#fff]`, `text-[0.875em]`, `w-[min(…)]`). Every value a component needs is a named theme value or utility (Appendix A). If one is missing, add it to `app/styles/tokens.ts` or `scripts/tailwind-theme.mjs` and to this document.
- `test/no-raw-colours.test.ts` scans `app/`, `public/`, `e2e/` and the config files. It fails on hex, `rgb()`/`hsl()` (and similar) literals, CSS named colours, Tailwind palette classes and arbitrary values. Only `app/styles/tokens.ts` and the generated files may contain colour literals, and the test checks that each generated file is exactly the generator's output.
- **`dark:` is never used.** Tailwind's `dark:` variant would follow the OS setting and ignore the user's explicit choice. Every difference between the themes, including shadows, is a token. The scan test also rejects `dark:` classes.

### 2.2 How the palettes are built

- **Light ("vellum"):**
  - The page is warm off-white parchment (`canvas` `#F7F2E8`), and content panels are a lighter vellum (`surface`).
  - Ink is a warm near-black brown (`fg` `#2B2118`), never pure black.
  - Links are **lapis** blue, after the manuscript pigment and the familiar wiki-link blue. The accent is **torch amber**, a burnt orange that is dark enough to carry white text.
- **Dark ("firelit hall"):** the rules are:
  1. **Warm charcoal, never black.** The canvas is `#16120E`, a brown-tinted charcoal, and no surface goes below `#110E0B`. Pure `#000` is banned.
  2. **Elevation is lighter.** Canvas `#16120E` → surface `#1D1814` → raised `#27211B`. Things nearer the reader are lighter, as if nearer the fire. Sunken wells (code, chips, inputs at rest) go darker, `#110E0B`.
  3. **Reduced saturation.** Every hue is desaturated and lightened, keeping roughly its light-mode hue angle. For example, lapis `#1F4F8F` → `#93B8EE`, and crimson danger `#A3123A` → `#F28BA0`. Status backgrounds are 8–12 % tints of the hue on charcoal, never saturated fills.
  4. **Text is vellum, not white.** `fg` is `#E4D9C6`, about 13:1 on the canvas. It is deliberately below the 15:1 of near-white text, which reduces halation on dark backgrounds. `fg-muted` and `fg-subtle` remain distinct steps below it.
  5. **The accent flips its role.** Amber becomes a light fill with _dark_ text (`accent-fg` `#1F1407`), like a lit lamp.
  6. **Shadows mostly disappear.** Depth comes from surface steps, plus a 1 px `border` and a faint top inner highlight (§4.4).

### 2.3 Core tokens

| Token (CSS var / Tailwind)                    | Light              | Dark               | Use                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bt-canvas` / `bg-canvas`                   | `#F7F2E8`          | `#16120E`          | Page background behind everything. Header and sidebar sit on canvas.                                                                                                                                                                                                   |
| `--bt-surface` / `bg-surface`                 | `#FFFCF6`          | `#1D1814`          | Main content sheet (article column), cards.                                                                                                                                                                                                                            |
| `--bt-surface-raised` / `bg-surface-raised`   | `#FFFFFF`          | `#27211B`          | Infobox, inputs, dialogs, drawer, menus, toasts.                                                                                                                                                                                                                       |
| `--bt-surface-sunken` / `bg-surface-sunken`   | `#EFE7D8`          | `#110E0B`          | Chips, code, table header rows, skeletons, segmented-control track.                                                                                                                                                                                                    |
| `--bt-border` / `border-border`               | `#E0D5C2`          | `#3A3129`          | Decorative hairlines: rules, card edges, dividers. **Not** for control boundaries.                                                                                                                                                                                     |
| `--bt-border-strong` / `border-border-strong` | `#8A7A64`          | `#7D6E5C`          | Boundaries of interactive controls (inputs, checkboxes, secondary buttons): ≥3:1.                                                                                                                                                                                      |
| `--bt-fg` / `text-fg`                         | `#2B2118`          | `#E4D9C6`          | Body text, headings.                                                                                                                                                                                                                                                   |
| `--bt-fg-muted` / `text-fg-muted`             | `#55483A`          | `#C7BAA7`          | Secondary text, labels, inactive tabs, infobox labels.                                                                                                                                                                                                                 |
| `--bt-fg-subtle` / `text-fg-subtle`           | `#6E6152`          | `#A69885`          | Meta text, captions, placeholders, external-link icons. Still ≥4.5:1 on every surface.                                                                                                                                                                                 |
| `--bt-link` / `text-link`                     | `#1F4F8F`          | `#93B8EE`          | Unvisited links (lapis).                                                                                                                                                                                                                                               |
| `--bt-link-visited` / `text-link-visited`     | `#6A3B80`          | `#C9A6E0`          | Visited links in prose only (murrey/purple).                                                                                                                                                                                                                           |
| `--bt-link-hover` / `text-link-hover`         | `#153A6D`          | `#BBD3F6`          | Hover and active link colour (together with the underline change).                                                                                                                                                                                                     |
| `--bt-accent` / `bg-accent`                   | `#A8470C`          | `#E9A440`          | Torch amber: primary button fill, current-tab bar, current-nav inset bar, infobox cap, logo flame outer, progress bar.                                                                                                                                                 |
| `--bt-accent-hover` / `bg-accent-hover`       | `#8C3B0A`          | `#F4BA62`          | Primary button hover and active.                                                                                                                                                                                                                                       |
| `--bt-accent-fg` / `text-accent-fg`           | `#FFFCF6`          | `#1F1407`          | Text and icons on `accent` fills.                                                                                                                                                                                                                                      |
| `--bt-accent-text` / `text-accent-text`       | `#9A410B`          | `#EDB25A`          | Amber used _as text_: wordmark "Torch", current nav item, small highlights.                                                                                                                                                                                            |
| `--bt-accent-subtle` / `bg-accent-subtle`     | `#FBEBD6`          | `#33240F`          | Tinted backgrounds: current nav item, chip hover, avatar initials.                                                                                                                                                                                                     |
| `--bt-accent-glow` / `bg-accent-glow`         | `#E8A33D`          | `#E9A440`          | **Decorative only.** Source colour of the hero glow. Never used for text or as the only boundary of anything.                                                                                                                                                          |
| `--bt-hero-glow` / `bg-hero-glow`             | `#FBECD5`          | `#2D2318`          | **Derived**, not hand-picked: `accent-glow` composited over `surface` at 18 % (light) or 8 % (dark), computed in `tokens.ts`. It is the strongest point of the home hero's radial glow, which always sits on `surface`. Text on the hero is checked against it (§2.7). |
| `--bt-focus` / `outline-focus`                | `#1F5FC4`          | `#8DB6FF`          | Focus ring. Blue, so it is distinct from amber selection and current-state marks.                                                                                                                                                                                      |
| `--bt-selection` / `bg-selection`             | `#F5D9A6`          | `#5C4322`          | `::selection` background. Text stays `fg`.                                                                                                                                                                                                                             |
| `--bt-scrim` / `bg-scrim`                     | `#2B2118`          | `#000000`          | Backdrop behind dialogs and the drawer, always used with an alpha (§4.4). The dark value is the only use of black, and it is never a surface.                                                                                                                          |
| `--bt-input-bg-locked` / `bg-input-bg-locked` | = `surface-sunken` | = `surface`        | Read-only and disabled fields (and the disabled checkbox box). An alias one step away from `input-bg` in each theme, so a locked field never looks like an editable one in dark, where `input-bg` is itself `surface-sunken`.                                          |
| `--bt-input-bg` / `bg-input-bg`               | = `surface-raised` | = `surface-sunken` | Text-control background at rest. An alias, so inputs sit in a well in dark mode without a `dark:` class.                                                                                                                                                               |
| `--bt-logo-core` / `fill-logo-core`           | `#E8A33D`          | `#F4BA62`          | **Decorative only.** Inner core of the logo flame (§5.9).                                                                                                                                                                                                              |

### 2.4 Status tokens (alerts, banners, inline messages, toasts)

Each family has four tokens, `--{s}-bg`, `--{s}-border`, `--{s}-fg` and `--{s}-icon`, exposed in Tailwind as `bg-info-bg`, `border-info-border`, `text-info-fg`, `text-info-icon` and so on.

- `border` is decorative, because an alert is identified by its icon and its words.
- `icon` meets ≥3:1 on both `{s}-bg` and `surface`.
- `fg` meets ≥4.5:1 on both `{s}-bg` and `surface`, so the same token can be used for inline field messages.

| Family             | Token                   | Light                                         | Dark                                          |
| ------------------ | ----------------------- | --------------------------------------------- | --------------------------------------------- |
| info               | bg / border / fg / icon | `#E9F0FA` / `#A9C0E2` / `#1D3D6B` / `#2A5A9C` | `#172230` / `#36527A` / `#C2D7F3` / `#8DB4EA` |
| success            | bg / border / fg / icon | `#E8F2E5` / `#9CC596` / `#1E4A1F` / `#2F6E2E` | `#16241A` / `#37603E` / `#C1E2BD` / `#88C383` |
| warning            | bg / border / fg / icon | `#FBF0D8` / `#DDBA70` / `#5A3C06` / `#8A5800` | `#2A2112` / `#6E5524` / `#F3DAA4` / `#E5B24E` |
| danger             | bg / border / fg / icon | `#FBE8EC` / `#E3A3B2` / `#7A1230` / `#B0204A` | `#2E161B` / `#7E3A4A` / `#F6C6D1` / `#F28BA0` |
| pending (approval) | bg / border / fg / icon | `#F2ECF8` / `#BFA9D8` / `#4A2E6B` / `#6B4C96` | `#241C2D` / `#5D4A7B` / `#DECDF2` / `#B99EE2` |

Pending approval uses a wax-seal purple on purpose. It is not a warning: nothing is wrong, the edit is simply waiting for a moderator.

**Destructive fills** (danger button):

| Token                                  | Light     | Dark      |
| -------------------------------------- | --------- | --------- |
| `--bt-danger`                          | `#A3123A` | `#F28BA0` |
| `--bt-danger-hover`                    | `#850E2F` | `#F7A9B9` |
| `--bt-danger-on` (text on danger fill) | `#FFFFFF` | `#2A0A12` |

**Danger is crimson, not red-orange.** The amber primary and a red-orange danger had a luminance ratio of about 1.1:1, so the two filled buttons looked the same. Danger therefore sits at a cooler crimson hue: 343° light and 348° dark, against amber's 23° and 36°. `npm run check:contrast` asserts that `accent` and `danger` (and their hover fills) differ by **at least 30° of hue** in both themes; today the gaps are 39° and 48°. Hue alone isn't enough, so a danger button also **always** carries an icon (`IconTrash` or `IconAlertTriangle`) and a verb ("Revoke token"). The danger status family (`danger-bg` … `danger-icon`) uses the same crimson hue, so error text and destructive buttons read as one family.

### 2.5 Conservation-status tokens

Used only by `ConservationBadge` and the conservation key on the help page. Each status has `--cons-{s}-bg`, `--cons-{s}-fg` and `--cons-{s}-border`. The border token also colours the badge icon, so it meets ≥3:1 on both the badge background and `surface`.

| Status (enum)           | Label                 | Icon (Tabler)       | bg (L / D)            | fg (L / D)            | border+icon (L / D)   | Border style |
| ----------------------- | --------------------- | ------------------- | --------------------- | --------------------- | --------------------- | ------------ |
| `low_risk`              | Low risk              | `IconShieldCheck`   | `#E3F0E0` / `#1A2A1C` | `#1F4D21` / `#BFE3BA` | `#3E7D3C` / `#6FAE69` | solid        |
| `endangered`            | Endangered            | `IconAlertTriangle` | `#FCEBD2` / `#2E2210` | `#6B3A00` / `#F5D29A` | `#B06A12` / `#D49A3C` | solid        |
| `critically_endangered` | Critically endangered | `IconAlertOctagon`  | `#FBE3DF` / `#331815` | `#7E1A12` / `#F8C3BA` | `#B8321F` / `#E57A6B` | solid, 2 px  |
| `restricted`            | Restricted            | `IconLock`          | `#E9E6EF` / `#24222E` | `#3A3450` / `#D6D1E6` | `#6A6385` / `#8F88AD` | solid        |
| `unassessed`            | Not yet assessed      | `IconCircleDashed`  | `#F1ECE3` / `#221D18` | `#55483A` / `#C7BAA7` | `#8A7A64` / `#7D6E5C` | **dashed**   |

Status is never shown by colour alone: there is always an icon, the label, and a different border weight or style for the two extremes. The enum `low_risk` is displayed as "Low risk" (sentence case).

### 2.6 Usage rules

- Text goes only on `canvas`, `surface`, `surface-raised`, `surface-sunken`, `accent-subtle`, `hero-glow`, a status `-bg`, or its own fill (`accent`, `danger`). Each of those pairs is in §2.7. **If a pair isn't in the table, add it and run the test before you use it.**
- In prose, links are distinguished by an underline as well as colour (WCAG 1.4.1). Outside prose, a link may drop the underline only inside a clearly navigational container: nav lists, tabs, chips, breadcrumbs, cards whose whole area is the link. It must still show an underline on hover or focus.
- Use `link-visited` in prose and search results only, not in nav, tabs or chips.
- Disabled controls use `text-fg-subtle` on `bg-input-bg-locked` with `border-border` (the checkbox box keeps `border-border-strong`, so an empty disabled box stays visible on dark `surface`). Disabled Pagination steps have no fill at all. WCAG exempts them from contrast, but they still pass.
- Opacity modifiers (`bg-accent/10`) are allowed for decoration only: hover washes behind text that is already compliant, or glows. **Never** put text on an opacity-modified background unless that pair has been tested.
- **The focus ring is never drawn inside an `accent` or `danger` fill.** Focus on `accent` is about 1.02:1 and on `danger` about 1.2:1, so an inset ring there would be invisible. Filled buttons always use the outset ring (§6.1). Anything inside a fill that must be focusable is redesigned instead, so that the current pagination item, for example, is a non-focusable `span`.

### 2.7 Contrast table (computed)

The ratios were computed with the WCAG 2.x relative-luminance formula:

- sRGB channels are linearised: c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4.
- L = 0.2126 R + 0.7152 G + 0.0722 B.
- ratio = (L1+0.05)/(L2+0.05).

`scripts/contrast.mjs` (`npm run check:contrast`, part of `validate`) reads **this table**. For each row it computes both ratios from `app/styles/tokens.ts`. It fails if a ratio is below the row's minimum, or if the printed ratio no longer matches the tokens, so the table can't go stale. It also checks the accent/danger hue gap (§2.4). **All 114 pairs pass in both themes.** Before you use a new pair, add a row (with any ratio) and run `npm run check:contrast`; it prints the real values to copy in.

- The minimum is 4.5:1 for text.
- The minimum is 3:1 for non-text UI: control boundaries, focus rings, icons that carry meaning, and badge edges.

| Pair (foreground on background)      | Min   | Light   | Dark    | Notes                                                       |
| ------------------------------------ | ----- | ------- | ------- | ----------------------------------------------------------- |
| `fg` on `canvas`                     | 4.5:1 | 14.11:1 | 13.34:1 | body text on page                                           |
| `fg` on `surface`                    | 4.5:1 | 15.38:1 | 12.61:1 | body text on surface                                        |
| `fg` on `surface-raised`             | 4.5:1 | 15.75:1 | 11.40:1 |                                                             |
| `fg` on `surface-sunken`             | 4.5:1 | 12.82:1 | 13.78:1 |                                                             |
| `fg-muted` on `canvas`               | 4.5:1 | 7.93:1  | 9.77:1  |                                                             |
| `fg-muted` on `surface`              | 4.5:1 | 8.64:1  | 9.23:1  |                                                             |
| `fg-muted` on `surface-raised`       | 4.5:1 | 8.84:1  | 8.34:1  |                                                             |
| `fg-muted` on `surface-sunken`       | 4.5:1 | 7.20:1  | 10.09:1 |                                                             |
| `fg-subtle` on `canvas`              | 4.5:1 | 5.39:1  | 6.61:1  |                                                             |
| `fg-subtle` on `surface`             | 4.5:1 | 5.87:1  | 6.25:1  |                                                             |
| `fg-subtle` on `surface-raised`      | 4.5:1 | 6.01:1  | 5.65:1  |                                                             |
| `fg-subtle` on `surface-sunken`      | 4.5:1 | 4.89:1  | 6.83:1  |                                                             |
| `link` on `canvas`                   | 4.5:1 | 7.31:1  | 9.17:1  |                                                             |
| `link` on `surface`                  | 4.5:1 | 7.97:1  | 8.66:1  |                                                             |
| `link` on `surface-raised`           | 4.5:1 | 8.16:1  | 7.83:1  |                                                             |
| `link` on `surface-sunken`           | 4.5:1 | 6.64:1  | 9.47:1  | chips                                                       |
| `link-visited` on `surface`          | 4.5:1 | 8.04:1  | 8.39:1  |                                                             |
| `link-visited` on `canvas`           | 4.5:1 | 7.38:1  | 8.89:1  |                                                             |
| `link-hover` on `surface`            | 4.5:1 | 11.04:1 | 11.54:1 |                                                             |
| `link-hover` on `surface-sunken`     | 4.5:1 | 9.20:1  | 12.61:1 |                                                             |
| `accent-text` on `canvas`            | 4.5:1 | 6.00:1  | 9.86:1  | accent text / wordmark                                      |
| `accent-text` on `surface`           | 4.5:1 | 6.54:1  | 9.32:1  |                                                             |
| `accent-text` on `accent-subtle`     | 4.5:1 | 5.73:1  | 7.94:1  | selected nav item                                           |
| `accent-fg` on `accent`              | 4.5:1 | 5.74:1  | 8.48:1  | primary button                                              |
| `accent-fg` on `accent-hover`        | 4.5:1 | 7.47:1  | 10.37:1 | primary hover                                               |
| `danger-on` on `danger`              | 4.5:1 | 7.76:1  | 7.80:1  | danger button                                               |
| `danger-on` on `danger-hover`        | 4.5:1 | 9.99:1  | 9.85:1  |                                                             |
| `fg` on `selection`                  | 4.5:1 | 11.52:1 | 6.59:1  | selected text                                               |
| `border-strong` on `surface`         | 3:1   | 4.06:1  | 3.57:1  | control edge (inputs, secondary buttons)                    |
| `border-strong` on `canvas`          | 3:1   | 3.73:1  | 3.78:1  |                                                             |
| `border-strong` on `surface-raised`  | 3:1   | 4.16:1  | 3.23:1  |                                                             |
| `border-strong` on `surface-sunken`  | 3:1   | 3.39:1  | 3.90:1  |                                                             |
| `focus` on `canvas`                  | 3:1   | 5.39:1  | 9.11:1  | focus ring                                                  |
| `focus` on `surface`                 | 3:1   | 5.87:1  | 8.61:1  |                                                             |
| `focus` on `surface-raised`          | 3:1   | 6.01:1  | 7.78:1  |                                                             |
| `focus` on `surface-sunken`          | 3:1   | 4.89:1  | 9.41:1  |                                                             |
| `accent` on `canvas`                 | 3:1   | 5.27:1  | 8.74:1  | primary button edge, current-tab bar                        |
| `accent` on `surface`                | 3:1   | 5.74:1  | 8.26:1  |                                                             |
| `danger` on `surface`                | 3:1   | 7.58:1  | 7.52:1  | danger button edge                                          |
| `link-visited` on `surface-raised`   | 4.5:1 | 8.23:1  | 7.59:1  |                                                             |
| `link-visited` on `surface-sunken`   | 4.5:1 | 6.70:1  | 9.18:1  |                                                             |
| `link-hover` on `canvas`             | 4.5:1 | 10.13:1 | 12.21:1 |                                                             |
| `link-hover` on `accent-subtle`      | 4.5:1 | 9.66:1  | 9.83:1  | chip hover                                                  |
| `link` on `accent-subtle`            | 4.5:1 | 6.98:1  | 7.38:1  | chip current                                                |
| `fg` on `accent-subtle`              | 4.5:1 | 13.47:1 | 10.74:1 |                                                             |
| `fg-muted` on `accent-subtle`        | 4.5:1 | 7.56:1  | 7.86:1  | chip facet prefix on hover and current                      |
| `danger-fg` on `canvas`              | 4.5:1 | 9.62:1  | 12.35:1 | field error text                                            |
| `danger-fg` on `surface-raised`      | 4.5:1 | 10.73:1 | 10.55:1 |                                                             |
| `success-fg` on `canvas`             | 4.5:1 | 9.16:1  | 13.20:1 |                                                             |
| `danger-icon` on `surface-raised`    | 3:1   | 6.66:1  | 6.80:1  | error input border; secondary-danger trigger edge           |
| `accent` on `surface-raised`         | 3:1   | 5.88:1  | 7.46:1  | logo outer flame                                            |
| `accent` on `surface-sunken`         | 3:1   | 4.79:1  | 9.02:1  |                                                             |
| `info-fg` on `info-bg`               | 4.5:1 | 9.48:1  | 10.94:1 | info alert text                                             |
| `info-icon` on `info-bg`             | 3:1   | 6.02:1  | 7.53:1  | info alert icon                                             |
| `info-fg` on `surface`               | 4.5:1 | 10.61:1 | 11.99:1 | info inline text on surface                                 |
| `info-icon` on `surface`             | 3:1   | 6.74:1  | 8.26:1  | inline icon                                                 |
| `success-fg` on `success-bg`         | 4.5:1 | 8.89:1  | 11.43:1 | success alert text                                          |
| `success-icon` on `success-bg`       | 3:1   | 5.39:1  | 7.82:1  | success alert icon                                          |
| `success-fg` on `surface`            | 4.5:1 | 9.98:1  | 12.47:1 | success inline text on surface                              |
| `success-icon` on `surface`          | 3:1   | 6.05:1  | 8.53:1  | inline icon                                                 |
| `warning-fg` on `warning-bg`         | 4.5:1 | 8.91:1  | 11.61:1 | warning alert text                                          |
| `warning-icon` on `warning-bg`       | 3:1   | 5.34:1  | 8.16:1  | warning alert icon                                          |
| `warning-fg` on `surface`            | 4.5:1 | 9.84:1  | 12.89:1 | warning inline text on surface                              |
| `warning-icon` on `surface`          | 3:1   | 5.90:1  | 9.06:1  | inline icon                                                 |
| `danger-fg` on `danger-bg`           | 4.5:1 | 9.13:1  | 11.16:1 | danger alert text                                           |
| `danger-icon` on `danger-bg`         | 3:1   | 5.67:1  | 7.20:1  | danger alert icon                                           |
| `danger-fg` on `surface`             | 4.5:1 | 10.48:1 | 11.67:1 | danger inline text on surface                               |
| `danger-icon` on `surface`           | 3:1   | 6.51:1  | 7.52:1  | inline icon; secondary-danger trigger edge                  |
| `pending-fg` on `pending-bg`         | 4.5:1 | 9.57:1  | 11.04:1 | pending alert text                                          |
| `pending-icon` on `pending-bg`       | 3:1   | 5.85:1  | 7.08:1  | pending alert icon                                          |
| `pending-fg` on `surface`            | 4.5:1 | 10.83:1 | 11.84:1 | pending inline text on surface                              |
| `pending-icon` on `surface`          | 3:1   | 6.62:1  | 7.59:1  | inline icon                                                 |
| `cons-low-fg` on `cons-low-bg`       | 4.5:1 | 8.31:1  | 10.71:1 | badge text                                                  |
| `cons-low-border` on `cons-low-bg`   | 3:1   | 4.24:1  | 5.70:1  | badge icon/border                                           |
| `cons-low-border` on `surface`       | 3:1   | 4.88:1  | 6.65:1  | badge edge vs surface                                       |
| `cons-end-fg` on `cons-end-bg`       | 4.5:1 | 8.05:1  | 10.77:1 | badge text                                                  |
| `cons-end-border` on `cons-end-bg`   | 3:1   | 3.65:1  | 6.28:1  | badge icon/border                                           |
| `cons-end-border` on `surface`       | 3:1   | 4.17:1  | 7.11:1  | badge edge vs surface                                       |
| `cons-crit-fg` on `cons-crit-bg`     | 4.5:1 | 8.39:1  | 10.53:1 | badge text                                                  |
| `cons-crit-border` on `cons-crit-bg` | 3:1   | 4.88:1  | 5.71:1  | badge icon/border                                           |
| `cons-crit-border` on `surface`      | 3:1   | 5.84:1  | 6.14:1  | badge edge vs surface                                       |
| `cons-res-fg` on `cons-res-bg`       | 4.5:1 | 9.53:1  | 10.51:1 | badge text                                                  |
| `cons-res-border` on `cons-res-bg`   | 3:1   | 4.56:1  | 4.68:1  | badge icon/border                                           |
| `cons-res-border` on `surface`       | 3:1   | 5.49:1  | 5.27:1  | badge edge vs surface                                       |
| `cons-un-fg` on `cons-un-bg`         | 4.5:1 | 7.52:1  | 8.76:1  | badge text                                                  |
| `cons-un-border` on `cons-un-bg`     | 3:1   | 3.54:1  | 3.39:1  | badge icon/border                                           |
| `cons-un-border` on `surface`        | 3:1   | 4.06:1  | 3.57:1  | badge edge vs surface                                       |
| `danger` on `canvas`                 | 3:1   | 6.96:1  | 7.96:1  | danger button edge                                          |
| `danger` on `surface-raised`         | 3:1   | 7.76:1  | 6.80:1  | danger button edge in a dialog                              |
| `accent-text` on `surface-raised`    | 4.5:1 | 6.70:1  | 8.42:1  | wordmark in the drawer                                      |
| `accent` on `accent-subtle`          | 3:1   | 5.03:1  | 7.03:1  | current nav item inset bar; current chip edge               |
| `border-strong` on `accent-subtle`   | 3:1   | 3.56:1  | 3.04:1  | chip hover edge                                             |
| `focus` on `accent-subtle`           | 3:1   | 5.14:1  | 7.33:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `info-bg`                 | 3:1   | 5.24:1  | 7.85:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `success-bg`              | 3:1   | 5.23:1  | 7.89:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `warning-bg`              | 3:1   | 5.31:1  | 7.75:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `danger-bg`               | 3:1   | 5.11:1  | 8.24:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `pending-bg`              | 3:1   | 5.19:1  | 8.03:1  | inset focus ring (dense containers, links in alerts)        |
| `focus` on `hero-glow`               | 3:1   | 5.17:1  | 7.52:1  | inset focus ring (dense containers, links in alerts)        |
| `fg` on `hero-glow`                  | 4.5:1 | 13.54:1 | 11.02:1 | home hero, strongest glow point                             |
| `fg-muted` on `hero-glow`            | 4.5:1 | 7.61:1  | 8.06:1  | hero lead                                                   |
| `link` on `hero-glow`                | 4.5:1 | 7.02:1  | 7.57:1  |                                                             |
| `border-strong` on `hero-glow`       | 3:1   | 3.58:1  | 3.12:1  | hero SearchBox edge                                         |
| `accent` on `hero-glow`              | 3:1   | 5.06:1  | 7.21:1  | hero logo mark                                              |
| `info-icon` on `surface-raised`      | 3:1   | 6.91:1  | 7.46:1  | toast icon and edge bar                                     |
| `success-icon` on `surface-raised`   | 3:1   | 6.19:1  | 7.71:1  | toast icon and edge bar                                     |
| `info-icon` on `surface-sunken`      | 3:1   | 5.62:1  | 9.02:1  | Info icon on sunken                                         |
| `accent-text` on `surface-sunken`    | 3:1   | 5.45:1  | 10.18:1 | external nav arrow on hover                                 |
| `fg-muted` on `success-bg`           | 4.5:1 | 7.69:1  | 8.46:1  | muted text in a success alert                               |
| `border-strong` on `success-bg`      | 3:1   | 3.62:1  | 3.27:1  | token value box and Copy button edge in the reveal          |
| `border-strong` on `danger-bg`       | 3:1   | 3.54:1  | 3.41:1  | secondary button edge in a danger alert (Settings "Log in") |
| `fg` on `input-bg-locked`            | 4.5:1 | 12.82:1 | 12.61:1 | read-only field value                                       |
| `fg-subtle` on `input-bg-locked`     | 4.5:1 | 4.89:1  | 6.25:1  | disabled field text (exempt, but passes)                    |
| `border-strong` on `input-bg-locked` | 3:1   | 3.39:1  | 3.57:1  | read-only dashed edge; disabled checkbox box                |

**Other non-text checks:**

- **Where the focus ring sits.** The default ring has a 2 px offset, so it sits on the surface around the control: `canvas`, `surface`, `surface-raised` or `surface-sunken`. In dense containers (tabs, chip rows, nav) the ring is inset (`outline-offset: -2px`), so it sits on whatever the item is filled with: `accent-subtle` (current nav item or current chip), a status `-bg` (links inside alerts) or `hero-glow`. All of these pairs are in the table. Inset rings never go on `accent` or `danger` fills (§2.6).
- **Filled buttons.** The `bg-accent` and `bg-danger` fills reach ≥3:1 against every surface they sit on, including `surface-raised` in dialogs, so the filled button's edge is visible.
- **Current tab.** The current tab is marked by a 3 px `accent` bar, which is ≥3:1 on every surface, _and_ by weight and colour. It never relies on colour alone.

---

## 3. Typography

### 3.1 Families and why

| Role                                          | Family                                                                                                                                                                  | Source                                                                                 | Why                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display: wordmark, h1–h3, hero, infobox title | **Fraunces Variable**, axes `wght` 300–700 and `opsz` 9–144 (the `opsz` files)                                                                                          | Self-hosted from `@fontsource-variable/fraunces` (pinned), latin and latin-ext subsets | A soft, old-style serif with optical sizing. It carries the manuscript and heritage feel at heading sizes without blackletter pastiche, and sets the site apart from Wikipedia's Linux Libertine. latin-ext covers Welsh ŵ ŷ, Old/Middle English þ ð ȝ æ, Irish and Norse diacritics. |
| Body, UI, h4, labels                          | **System sans**: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"` | None (local)                                                                           | Most legible at small sizes on every OS. Zero bytes and zero layout shift for 95 % of the text. Native script coverage for any language a piece title uses. Feels "of the device", which keeps the UI modern.                                                                         |
| Code, tokens, API keys                        | `ui-monospace, "SF Mono", "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, monospace`                                                                  | None (local)                                                                           | Same reasons.                                                                                                                                                                                                                                                                         |

Tailwind `fontFamily` (replaced, not extended): `display: ['"Fraunces Variable"', '"Fraunces Fallback"', '"Fraunces Fallback Noto"', 'serif']`, `sans: [system stack]`, `mono: [mono stack]`. The `body` element is `font-sans`. Headings are `font-display`.

**Loading strategy (no CLS, hard requirement):**

1. **Source:** the files come straight from the pinned `@fontsource-variable/fraunces` package, referenced from our own CSS (`app/styles/fonts.css`). There is no copy script, and Vite fingerprints the files into `/assets/`.
   - Only the **`opsz`** files are used (`fraunces-latin-opsz-normal.woff2` and `fraunces-latin-ext-opsz-normal.woff2`). They carry the `wght` and `opsz` axes and nothing else, so they are smaller than the `full` files, which add `SOFT` and `WONK`. `SOFT` is therefore not used: headings use Fraunces' default softness (0). This is a deliberate trade of a little softness for a lighter download.
   - No italic face is loaded. Headings never use italic, and `font-synthesis: none` is set on `.font-display`, so the browser never fakes italic or bold.
   - `font-variation-settings` is not set on headings, because `font-optical-sizing: auto` drives `opsz` from the size. The only exception is the wordmark, which pins `"opsz" 32` (§3.2).
2. Our `@font-face` rules (we don't import the package CSS, which uses `swap`) use `font-display: optional`, with the `unicode-range` values copied from the package's `opsz.css`.
   - `optional` means the browser uses Fraunces only if it arrives within the ~100 ms block period, and otherwise keeps the fallback **for the life of the page**. A font swap therefore can never cause a shift.
   - We accept that slow first visits (often mobile) see the fallback. That is why the fallback is metric-matched and keeps the heading weights (step 4).
3. `root.tsx` `links()` preloads the latin file. It imports the same file with `?url`, so the preload and the `@font-face` share one fingerprinted URL: `{ rel: "preload", href, as: "font", type: "font/woff2", crossOrigin: "anonymous" }`. `/assets/*` is served `immutable` (`public/_headers`), so later visits hit the cache. How often a first visit makes the block period has not been measured.
4. **Metric-matched fallbacks**, so the fallback render looks intentional and doesn't shift when the font is cached for the next page:
   - `"Fraunces Fallback"` uses `local("Georgia")` for weights 100–549 and `local("Georgia Bold")` / `local("Georgia-Bold")` for weights 550–900. The weight ranges mean 560 and 600 headings render with the bold face, so hierarchy survives without synthesis.
   - `"Fraunces Fallback Noto"` does the same with `local("Noto Serif")` and `local("Noto Serif Bold")` / `local("NotoSerif-Bold")`. Android has no Georgia, so most mobile fallback renders use this face.
   - Each face sets `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`. The values are computed **once** by `scripts/font-fallback-metrics.mjs` with the same formula as `fontaine`, from the installed Fraunces file (via `@capsizecss/unpack`) against the published Georgia and Noto Serif metrics (`@capsizecss/metrics`):
     - `size-adjust` = Fraunces xWidthAvg/UPM ÷ fallback xWidthAvg/UPM
     - `ascent-override` = Fraunces ascent/UPM ÷ size-adjust
     - `descent-override` = |Fraunces descent|/UPM ÷ size-adjust
     - `line-gap-override` = Fraunces lineGap/UPM ÷ size-adjust
   - The output is committed as constants in `app/styles/fonts.css`. Re-run the script only when the Fraunces version changes.
5. **Test (C8):** a Playwright test loads `/` with the cache disabled and records `layout-shift` entries via `PerformanceObserver`. **CLS MUST be 0.00.**

### 3.2 Type scale

The base is 16 px (1 rem). The scale is about a 1.2 minor third, rounded to 4 px-friendly line heights. Mobile sizes apply below `md` (768 px). Fraunces uses `font-optical-sizing: auto`, so `opsz` follows the size.

**Implementation:** each size is a CSS variable (`--bt-text-h1` and so on) in the generated `tokens.css`. It holds the mobile value, and an `@media (min-width: 768px)` block switches it to the desktop value. Each Tailwind `text-*` class sets the size, line height, letter-spacing and weight together, so `text-h1` is the whole style at every width, with no `md:` prefix. The family is a separate class (`font-display` or `font-sans`). Tailwind's default size scale (`text-sm`, `text-xl` …) is replaced and doesn't exist.

| Token (Tailwind `text-*`) | Family  | Size (≥md)         | Size (<md)        | Line height | Weight                 | Letter-spacing                      | Use                                                                          |
| ------------------------- | ------- | ------------------ | ----------------- | ----------- | ---------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `display`                 | display | 2.75rem (44 px)    | 2.125rem (34 px)  | 1.1         | 560                    | -0.02em                             | Home hero only                                                               |
| `h1`                      | display | 2.25rem (36 px)    | 1.875rem (30 px)  | 1.15        | 560                    | -0.015em                            | Page title, one per page                                                     |
| `h2`                      | display | 1.625rem (26 px)   | 1.5rem (24 px)    | 1.25        | 560                    | -0.01em                             | Prose sections, with rule beneath                                            |
| `h3`                      | display | 1.25rem (20 px)    | 1.1875rem (19 px) | 1.35        | 600                    | 0                                   | Sub-sections, card titles, infobox title                                     |
| `h4`                      | sans    | 1rem (16 px)       | 1rem              | 1.4         | 650                    | 0                                   | Minor heads, dialog section heads                                            |
| `body-lg` (prose)         | sans    | 1.0625rem (17 px)  | 1rem (16 px)      | 1.65        | 400                    | 0                                   | Article prose                                                                |
| `body`                    | sans    | 1rem (16 px)       | 1rem              | 1.5         | 400                    | 0                                   | UI text, forms, cards                                                        |
| `body-sm`                 | sans    | 0.875rem (14 px)   | 0.875rem          | 1.5         | 400 / 500 for controls | 0                                   | Nav, tabs, chips, infobox values, buttons-sm                                 |
| `caption`                 | sans    | 0.8125rem (13 px)  | 0.8125rem         | 1.4         | 500                    | 0.01em                              | Meta lines, help text, timestamps                                            |
| `label-caps`              | sans    | 0.75rem (12 px)    | 0.75rem           | 1.33        | 650                    | 0.08em, `text-transform: uppercase` | Sidebar group heads, infobox section heads, "Categories" label. Max 3 words. |
| `code`                    | mono    | 0.875em (relative) | same              | 1.5         | 400                    | 0                                   | Inline and block code                                                        |
| `wordmark`                | display | 1.375rem (22 px)   | 1.25rem (20 px)   | 1           | 600                    | -0.01em                             | The wordmark only (`opsz` pinned at 32)                                      |

- The wordmark (`text-wordmark font-display`) is Fraunces 600 at `opsz` 32. "Bardic" is `text-fg` and "Torch" is `text-accent-text`.
- Use `text-wrap: balance` on h1–h3 and `text-wrap: pretty` on prose paragraphs, as progressive enhancement.
- The minimum rendered size is 12 px (`label-caps` only). Nothing interactive is smaller than 14 px.

### 3.3 Measure and prose

- Prose container is `.prose-bt`: `max-width: 68ch` (about 700 px at 17 px). Infobox floats sit inside the container, but text beside them never goes below `20ch`. When it would, the infobox stacks instead, via a container query on the main column: `@container (max-width: 36rem)`.
- **Vertical rhythm:** paragraphs have `margin-block: 0 1em`. Headings have `scroll-margin-top: calc(var(--bt-header-h) + 0.5rem)`, so TOC and anchor jumps don't land under the sticky header (§6.1, WCAG 2.4.11). h2 has `margin-top: 2em; margin-bottom: 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid rgb(var(--bt-border))` (this is the wiki rule, in warm hairline). h3 has `margin-top: 1.5em; margin-bottom: 0.4em`.
- **Links:** `text-link underline decoration-1 underline-offset-prose decoration-link-40` (`underline-offset-prose` = 0.2em).
  - On hover: `text-link-hover decoration-2 decoration-link-hover`.
  - Visited: `text-link-visited decoration-link-visited-40`.
  - External prose links get a trailing `IconExternalLink` at 0.85em, `text-fg-subtle`, `aria-hidden`, plus visually hidden "(external link)". The icon is wrapped with the last word in `white-space: nowrap` so it never orphans.
- **Lists:** `padding-left: 1.5em`.
  - `ul` markers are `fg-subtle`. Amber is kept for signals (§1.4), and help pages are mostly lists. `::marker` is the default disc, and nested lists use `circle`.
  - `ol` uses `decimal`, then `lower-alpha` for nested lists, with markers in `fg-muted`.
  - `li + li` has `margin-top: 0.25em`.
- **Blockquote:** `border-left: 3px solid rgb(var(--bt-border-strong))`, `padding: 0.25em 0 0.25em 1em`, `color: fg-muted`, Fraunces 400 italic is **not** used (no italic face loaded). Use sans 1.0625rem with `font-style: normal`.
  - The attribution sits in a `<footer>` with `caption` styling, prefixed with "— ".
- The prose styles live in `app/styles/prose.css` as the `.prose-bt` component class. Markdown help content (FE1) is rendered inside it. Every rule is written `:where(…):not(:where(.not-prose, .not-prose *))`: a component placed in prose that draws its own lists, headings or links (CardList) puts `not-prose` on its root, and nothing inside it is restyled.
- **Tables:**
  - Full width of the measure, `border-collapse: collapse`, `body-sm`.
  - `th` has `bg-surface-sunken text-fg font-semibold text-left`, and cells have `padding: 0.5rem 0.75rem; border-bottom: 1px solid border; vertical-align: top`, so a short row label sits level with the first line of a long value.
  - In help pages each body row gets an id from its first cell, slugged like a heading (`#low-risk`), with the headings' `scroll-margin-top`, so an infobox row can link to its own table row and each ConservationBadge link lands on its status's row (§6.13).
  - Wrap in `<div class="overflow-x-auto" tabindex="0" role="region" aria-label="{caption}">` for horizontal scroll at 360 px.
  - `caption` uses caption style, `text-fg-muted`, aligned left and on top.
- **Definition lists** (used for "at a glance" and preference lists):
  - At ≥sm, `dl` is a grid: `grid-template-columns: minmax(8rem, max-content) 1fr; gap: 0.25rem 1rem`.
  - `dt` is `font-semibold text-fg-muted body-sm`, and `dd` is `body`. Below sm they stack, with `dd` given `margin-bottom: 0.5rem`.
- **Inline code:** `font-mono text-code bg-surface-sunken text-fg px-1.5 py-0.5 rounded-sm border border-border`.
- **Code blocks:** `bg-surface-sunken p-4 rounded-md overflow-x-auto` plus the same focusable region rule as tables.
- **`hr`:** a 1 px `border` line with a centred decorative 8 px lozenge (`◆`, `text-border-strong`, drawn by CSS `::after` so it is never read out). Margin `2em auto`.
- **Abbreviations and small caps:** `abbr[title]` uses a dotted underline.

---

## 4. Spacing, radii, borders, elevation

### 4.1 Spacing

Use the 4 px scale (Tailwind 3's default steps, kept as named keys) only. **No arbitrary spacing values.** Sizes that aren't on the scale (header height, infobox and drawer widths, the textarea minimum and so on) are named theme values or utilities, listed in Appendix A. Use these steps: `0.5` = 2 px, `1` = 4 px, `1.5` = 6 px, `2` = 8 px, `3` = 12 px, `4` = 16 px, `5` = 20 px, `6` = 24 px, `8` = 32 px, `10` = 40 px, `12` = 48 px, `16` = 64 px, `20` = 80 px, `24` = 96 px.

| Semantic use                                | Value                                                               |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Icon–label gap in controls                  | 2 (8 px), or 1.5 (6 px) in `sm` controls                            |
| Control internal padding x                  | sm 3 (12 px), md 4 (16 px), lg 5 (20 px)                            |
| Stack gap between form fields               | 5 (20 px)                                                           |
| Card padding                                | 4 (16 px) mobile, 5 (20 px) ≥md                                     |
| Page gutter (horizontal)                    | 4 (16 px) <md, 6 (24 px) md, 8 (32 px) lg, 10 (40 px) xl            |
| Section gap (between page sections)         | 10 (40 px) <md, 12 (48 px) ≥md                                      |
| Gap between chips                           | 2 (8 px)                                                            |
| Header height (`--bt-header-h`, `h-header`) | 56 px <md, 64 px ≥md                                                |
| Bottom app bar (`h-app-bar`)                | 56 px plus `env(safe-area-inset-bottom)`, border included, <md only |

### 4.2 Radii

These replace Tailwind's default radii, so `rounded-2xl` and friends don't exist.

| Token          | Value   | Use                                                        |
| -------------- | ------- | ---------------------------------------------------------- |
| `rounded-none` | 0       | Banners at <md                                             |
| `rounded-sm`   | 4 px    | Inline code, small badges, checkbox                        |
| `rounded-md`   | 6 px    | Buttons, inputs, selects, tabs' top corners, skeleton bars |
| `rounded-lg`   | 10 px   | Cards, infobox, alerts, menus, toasts                      |
| `rounded-xl`   | 16 px   | Dialogs, drawer inner edge, hero panel                     |
| `rounded-full` | 9999 px | Chips, conservation badges, avatar, theme-toggle track     |

### 4.3 Borders

- The default width is 1 px. The only exceptions are the current-tab bar and the infobox top cap (3 px), the critically-endangered badge (2 px), and the focus ring (2 px).
- Decorative edges use `border-border`. Control edges use `border-border-strong`.
- An error control has a 2 px `danger-icon` border. The extra width is so the state doesn't rely on colour alone. It always comes with an icon and a message.

### 4.4 Elevation

Shadows are tokens, defined per theme in `tokens.ts` as `--bt-shadow-1…3` (full `box-shadow` values, not channels) and exposed as `shadow-1`, `shadow-2` and `shadow-3` (plus `shadow-none`). They replace Tailwind's default shadows. The light shadows are tinted warm brown and the dark ones are mostly an inner highlight, so no `dark:` class is ever needed.

| Level | Used by                            | Light                                                                        | Dark                                                                                      |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0     | Page content, sidebar              | none                                                                         | none                                                                                      |
| 1     | Cards, infobox, header (on scroll) | `0 1px 2px rgb(60 40 20 / 0.06), 0 1px 3px rgb(60 40 20 / 0.08)`             | `inset 0 1px 0 rgb(255 236 210 / 0.04)` + surface step + `border`                         |
| 2     | Menus, popovers, toasts            | `0 4px 8px -2px rgb(60 40 20 / 0.10), 0 2px 4px -2px rgb(60 40 20 / 0.06)`   | `0 4px 12px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 236 210 / 0.05)` on `surface-raised` |
| 3     | Dialog, drawer                     | `0 16px 32px -8px rgb(60 40 20 / 0.20), 0 4px 8px -4px rgb(60 40 20 / 0.10)` | `0 16px 40px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 236 210 / 0.06)` on `surface-raised` |

- **Scrim** (behind dialogs and the drawer) is `rgb(var(--bt-scrim) / 0.5)` in light and `/ 0.65` in dark. The alpha is the per-theme effect token `--bt-scrim-alpha`, used as `backdrop:bg-scrim-scrim`, so no `dark:` class is needed.
  - `--bt-scrim` is `#2B2118` in light and `#000000` in dark. The dark value is the only use of black, and it is never a surface.
- In dark mode, every elevated element MUST also have `border border-border`, because shadows are nearly invisible on charcoal.

---

## 5. Layout

### 5.1 Breakpoints

These are the Tailwind defaults. The screenshot widths are 360, 768 and 1280.

| Name | Min width                               | Layout                                                                                                                    |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| base | 0 (design floor 360 px; reflows at 320) | Single column, header controls in the bottom app bar, nav in drawer, infobox stacked                                      |
| `sm` | 640 px                                  | Wider forms, dl in grid                                                                                                   |
| `md` | 768 px                                  | Header 64 px with Menu, inline search, theme toggle and account; no bottom bar; infobox floats right; nav still in drawer |
| `lg` | 1024 px                                 | Persistent left sidebar                                                                                                   |
| `xl` | 1280 px                                 | Wider sidebar and infobox, wider gutters                                                                                  |

The app shell has `max-width: 90rem` (1440 px) and is centred. The canvas extends full-bleed.

### 5.2 Header and bottom app bar

- The header is a `<header>` landmark, `bg-canvas`, with a bottom border `border-border`.
- It is sticky (`top: 0`), and gets `shadow-1` once the page has scrolled more than 8 px (an IntersectionObserver sentinel). Without JS it simply has no shadow.
- Height is `--bt-header-h`: 56 px below `md` and 64 px from `md` up, its bottom border included (the `header` element is `h-header`), so the sticky sidebar's `max-height: calc(100dvh - var(--bt-header-h))` adds up to the window exactly and a short page doesn't overflow by 1 px. `html` has `scroll-padding-top: calc(var(--bt-header-h) + 0.5rem)`, so an element that receives focus by Tab or by an anchor jump is never hidden under the sticky header (WCAG 2.4.11).
- The first focusable element is a **skip link**, "Skip to content", which is visually hidden until focused and then appears as a primary `sm` button at top-left. Its padding is applied only on focus (`focus:px-3 focus:py-2`), so the hidden link stays a 1 px box rather than a padded 24 × 16 one.

**Below `md`, the header's controls move to a bottom app bar** (one-handed use). The top header then holds only the logo and wordmark, so nothing in it can overflow at 360 px. An e2e check asserts no horizontal overflow at 360 (and 320) px, signed out and signed in.

| Slot            | <md (360)                                                                                                                | md (768)                                                                                                                                       | ≥lg (1280)                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Logo + wordmark | Top header, left. Mark 24 px + wordmark 20 px. A link to `/` whose accessible name is the wordmark text, "Bardic Torch". | Mark 28 px + wordmark 22 px, after the Menu button                                                                                             | Same, left-aligned to the sidebar column                  |
| Menu            | **Bottom bar**, left cell                                                                                                | Top header, left: ghost icon button 44 × 44 (`IconMenu2`, label "Menu")                                                                        | Hidden (sidebar persistent)                               |
| Search          | **Bottom bar**, middle cell                                                                                              | Inline SearchBox in the header, flexible, max 28rem                                                                                            | Inline SearchBox, 28rem, starts at the main column        |
| Theme toggle    | **In the drawer**                                                                                                        | Header: icon-only segmented control (3 × 36 px); its "Theme" label and option names are `sr-only`, leaving the search room for its placeholder | Header: visible label "Theme" + icon **and text** buttons |
| Account         | **Bottom bar**, right cell                                                                                               | Avatar 36 px in a 44 px hit area, or "Log in" secondary `sm`                                                                                   | Same                                                      |

**Bottom app bar** (<md only):

- It is part of the `<header>` landmark in the DOM (after the logo link), positioned `fixed inset-x-0 bottom-0`. So the Tab order at 360 px is skip link → logo → Menu → Search → Account → main content, and the bar needs no landmark of its own.
- Its height is `h-app-bar`: 56 px plus `padding-bottom: env(safe-area-inset-bottom)`, for the whole box, its top border included. It is `bg-surface-raised border-t border-border shadow-2`, with three equal cells: **Menu · Search · Account**. The room the page keeps under its end (`pb-app-bar`) is the same expression (`APP_BAR_BOX` in `scripts/tailwind-theme.mjs`), so the bar never covers the end of the page, whatever the fonts make the page's height come to (an e2e check, which also checks the bar is as tall as that room).
- Each cell is a full-height control (at least 44 × 55 px: the bar's 56 px less its top border) with a 24 px icon above a visible `caption` label: "Menu" (`IconMenu2`), "Search" (`IconSearch`), and "Account" (avatar initials) or "Log in" (`IconLogin`). The visible label is the accessible name.
- `body` has `padding-bottom: calc(56px + env(safe-area-inset-bottom))` below `md`, and `html` has the same `scroll-padding-bottom`, so the bar never covers the end of the page or the focused element.
- **Menu** opens the drawer as a bottom sheet, nearest its trigger (§6.21).
- **Search** opens a search sheet just above the bar with JS: a SearchBox (§6.26) with the input focused and a "Cancel" button. Escape or Cancel closes it and returns focus to the Search cell. Without JS, Search is a link to `#site-nav`, the no-JS navigation, which starts with the SearchBox.
- **Account** opens the account panel upwards, above the bar (§6.25). Signed out, it is a link to `/auth/login?returnTo={current path}`.
- **Built as (FE1):** `app/components/BottomBar.tsx`, a `role="group"` named "App bar" (a group, not a landmark), so its Menu, Search and Account have a context of their own apart from the header's copies. Only one copy of each is rendered at any width: the header's are `display: none` below md and the bar is `display: none` from md. The search sheet is non-modal (`aria-expanded` on the Search cell, `useDismiss` closing rules, so focus moving past it closes it too). Body padding is `max-md:pb-app-bar` on the shell wrapper, so the standalone error page, which has no bar, gets none; `scroll-padding-bottom` is in `base.css` below md.

### 5.3 Left sidebar / navigation

- The sidebar is a `<nav aria-label="Site">`.
- At ≥lg it is persistent: 15rem (240 px) at lg and 16rem (256 px) at xl. It is `bg-canvas` with no border; the main sheet's edge separates them.
- It sticks below the header (`top: 64px`) with `max-height: calc(100dvh - 64px)` and `overflow-y: auto` (scrollbar `thin`), and has `padding: 24px 16px 32px 0` (lg) / `24px 24px 32px 0` (xl).
- Below lg, the same component renders inside the Drawer (§6.21).

**Structure** (group heading `label-caps text-fg-subtle`, `mb-2`, `mt-6` except first; at ≥lg `mb-1` and `mt-5`; items `body-sm`). The "Site menu" `h2` heads the nav at every width (`lg:sr-only` in the persistent sidebar), so the group `h3`s always sit under an `h2`.

```
BROWSE                                  ← group heading
  Pieces                                 → /pieces
  Bards                                  → /bards
  Collections                            → /collections
  Events and venues                      → /events
  Categories                             → /categories
FACETS
  Genre / kind                           → /categories?facet=kind
  Mood                                   → /categories?facet=mood
  Topic                                  → /categories?facet=topic
  Culture                                → /categories?facet=culture
  Language                               → /categories?facet=language
  Legendaria                             → /categories?facet=legendaria
  Origin                                 → /categories?facet=origin
  Conservation                           → /categories?facet=conservation
HELP
  Contributing                           → /help/contributing
  FAQ for bards                          → /help/faq-for-bards
  Bard preference checklist              → /help/bard-preference-checklist
  Conservation status                    → /help/conservation-status
  Licence & attribution                  → /help/licence
CONTRIBUTE                               ← ContributeCard (see below)
```

- The URL map lives in one typed, read-only module, `app/constants/navigation.ts`. Each entry is `{label, href}`, and every sidebar entry is an internal path. The help pages' slugs and sidebar labels are listed once there too (`HELP_PAGES`); the help route, the sidebar, the footer and the home page take their addresses from it. The module also holds the catalogue search target (`SEARCH`: `/search`, parameter `q`), the contact form (`https://forms.gle/wUwWnMKtWZSUisWCA`, until FE4) and the original wiki's addresses, which are used only for the help pages' attribution, the footer's "Original wiki" link and the 404 page's secondary link. Whether a link is external, and to the wiki or elsewhere, follows from its address alone (`externalKind` in `app/components/ui/Link.tsx`). `bardictorch.miraheze.org` appears only in this module, the help content and the docs (a repo-hygiene test checks this).
- **Nav item:**
  - Layout: `flex items-center gap-2 min-h-11 (44px) <lg / min-h-7 (28px) ≥lg`, `px-3`, `rounded-md`, `text-fg-muted`. Focus ring inset (`-outline-offset-2`). The tighter ≥lg rhythm lets Browse, Facets and the whole Help group fit in an 800 px tall window, clear of the "more below" fade. The rows, headings and gaps don't depend on the sans the reader's system has; only a label that wraps does, and it adds one line to its row. At 1280 × 800 the Help group's last item ends at 692 px, 84 px above the fade's top (776 px), in the Playwright image's sans and in DejaVu Sans (Ubuntu's default sans); with 0.1em wider text DejaVu wraps the longest label, "Bard preference checklist", and the item ends at 706 px. FE1's 32 px rows left too little room for its Browse note, the one block whose height depended on the font: with DejaVu Sans the Help group's last item fell 0.6 px below the fold. The e2e check runs with both sans, plain and with 0.1em wider text (docs/TESTING.md, "Fonts").
  - Hover: `bg-surface-sunken text-fg`.
  - Focus-visible: standard ring.
  - Current (`aria-current="page"`, for the section being shown: `/pieces/*`, including a piece's history, marks Pieces; a facet entry is current only on its own `/categories?facet=…`, and Categories is not current while a facet is picked, so one entry is current per page): `bg-accent-subtle text-accent-text font-semibold`, plus a 3 px `accent` bar on the left inset (`box-shadow: inset 3px 0 0 rgb(var(--bt-accent))`).
  - On desktop the 28 px height is above the 24 px minimum (WCAG 2.5.8; ≥lg is a pointer layout).
- **Taller than the window:** the sidebar scrolls on its own. On each page it scrolls itself (never the page) so the current item is in view and clear of the fade, and while anything is below its fold a 24 px `bg-fade-up` fade sits at its foot (sticky, `aria-hidden`), so the ContributeCard's existence is signalled. The sidebar's end space is padding on an inner wrapper, not on the scroller, so the fade's solid end meets the sidebar's visible foot (a sticky element stops at its scroller's padding edge). The navigation Drawer likewise scrolls its body to the current page's link when it opens.
- **ContributeCard:**
  - `rounded-lg border border-border bg-surface p-4`.
  - The logo mark sits at 20 px, with the heading "Keep the torch lit" (`h4`) and the text "Anyone can add a piece, a link or a performance." (`body-sm text-fg-muted`).
  - A secondary `sm` full-width button, "Start contributing", goes to `/help/contributing`.

### 5.4 Main column

- `<main id="content" tabindex="-1">` is the skip-link target. After a client navigation to another path (not a hash jump, not the first load), focus moves to `main` (`preventScroll`), as a document load would leave the reader at the start, and a polite `sr-only` status announces the new `document.title`. It contains a **sheet**: `bg-surface border border-border rounded-xl shadow-1` at ≥lg. Below lg, the sheet is full-bleed with no border or radius, and `bg-surface` runs to the edges.
- **Short pages:** the shell is a `min-h-dvh` flex column, so the footer sits at the bottom of the window. Below lg `main` takes the spare height (the full-bleed surface runs down to the footer); from lg the grid's rows are `1fr auto` (`grid-rows-shell`) and the sheet is `self-start`, as tall as its content, so a blocked or error page never shows an empty stretched card.
- Sheet padding: 16 px <md, 24 px md, 32 px lg, 40 px xl. It sits `mt-6 mb-10` at ≥lg.
- The **page head** has these parts, in order:
  1. Breadcrumbs (optional, caption).
  2. `h1`.
  3. Optional subtitle or meta line (`body-sm text-fg-muted`, for example "Song · 1994"; built in FE2 on every entity head). Help pages have none: the breadcrumb already says "Help".
  4. The **tab row**, which sits on the title rule. The rule is the tab row's 1 px `border-border` bottom border, running the full sheet width. When a page has only one view (every FE1 page), the row holds a non-interactive "Read" label instead of tabs (§6.9).
  5. 24 px gap, then content.
- The right of the tab row holds page meta (`caption text-fg-subtle`, for example "Adapted from the original wiki ↗" on help pages, or "Last edited 3 Oct 2026" in FE2+). It wraps under the label below sm rather than hiding, because on help pages it is the only source link.
- Below the tab row, the order is: optional status banners (stub, restricted and prefers-no-page, built in FE2; pending is FE3), then content (infobox first in source order), then category chips, then the licence meta line.

### 5.5 Infobox placement

- **≥md:** `float: right; width: 16.5rem` (264 px) at md–lg and `20rem` (320 px) at xl (`w-infobox-xl`); `margin: 0 0 24px 32px`, `clear: right`.
- **<md** (or when the main column is <36rem, via container query): full width, placed directly after the tab row and banners and before the prose, with `margin-bottom: 24px`. It is not collapsible, because its facts are the page.
- It is placed first in the DOM, so the reading order matches the visual order on every layout.

### 5.6 Category chip row

- It sits at the bottom of the sheet, after a `border-t border-border pt-6 mt-10`.
- It is `<nav aria-label="Categories">` with a `label-caps` heading "Categories", followed by a `TagList` (§6.12). The facet name is the chip prefix, for example "Mood: Singalong".

### 5.7 Footer

- `<footer>` on `bg-canvas`, `border-t border-border`, `py-10`, `caption`/`body-sm text-fg-muted`, max width aligned to the main column. Its content:
  - The logo mark at 20 px, followed by "Bardic Torch: an index of bardic pieces, kept by the community."
  - The licence: "Text is available under the **Creative Commons Attribution-ShareAlike 4.0** licence." The link goes to `https://creativecommons.org/licenses/by-sa/4.0/` and is external, with an icon. Help pages credit the original wiki's contributors on the page itself (§10.2).
  - The disclaimer: "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
  - **HelpLinks** (FE1), the consistent help mechanism (WCAG 3.2.6): **Contact** (the contact form, external, from `navigation.ts`) · **Help** (`/help`) · **Licence & attribution** (`/help/licence`), always in this order, followed by "Original wiki ↗". HelpLinks is one component, and it renders in the same relative order with the same hrefs on every template: home, help pages, settings, the 404 page, and the standalone root error page (§10.5), which otherwise has no shell. A test renders all of these and compares the order and hrefs.
- Links are separated by `·` (`aria-hidden`) inside a `ul` with inline items, and wrap freely at 360 px. The list is a `separated-list` (`app/styles/base.css`): every item starts with its mark, the list is pulled left by one mark's width and `clip-path`-ed there, so the mark that starts each line is never painted and no line starts with a `·` (the clip stays 0.5rem clear of focus rings on the other sides). Each link is `inline-flex min-h-6 items-center` (24 px), and the list has `gap-y-2` when it wraps, so the footer links meet WCAG 2.5.8 even though their text is `caption`.

### 5.8 Wireframes

These show a help page (`/help/conservation-status`), signed in. Signed out, the account slot reads "Log in".

**Desktop, 1280 × 800:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [skip] 🔥 Bardic Torch     [🔍 Search the catalogue…        ]  Theme [▣ System|☀ Light|☾ Dark] (JD ▾)│ 64
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ BROWSE               ┌───────────────────────────────────────────────────────────────────────┐ │
│ Pieces               │ Help › Conservation status                                            │ │
│ Bards                │ Conservation status                                     (h1 Fraunces) │ │
│ Collections          │                                                                       │ │
│ Events and venues    │ Read (label, not a tab)           Adapted from the original wiki ↗    │ │
│ Categories           │ ───────────────────────────────────────────────────────────────────── │ │
│                      │                                              ┌─ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ─┐ │ │
│                      │ Conservation statuses help flag works that   │  At a glance (h2)     │ │ │
│ FACETS               │ may need more work to preserve them …        │  STATUSES (h3)        │ │ │
│ Genre / kind         │                                              │  Low risk             │ │ │
│ Mood                 │ Contents                                     │  Endangered           │ │ │
│ Topic                │  1 Low risk  2 Endangered  3 …               │  Critically endangered│ │ │
│ Culture              │                                              │  Restricted           │ │ │
│ Language             │ Low risk                         (h2)        │  Not yet assessed     │ │ │
│ Legendaria           │ ───────────────────────────                  └───────────────────────┘ │ │
│ Origin               │ A work is low risk if it exists in at least four places …              │ │
│ Conservation         │  • Recordings on YouTube                                              │ │
│ HELP                 │                                                                       │ │
│▌Conservation status  │ ───────────────────────────────────────────────────────────────────── │ │
│ Contributing         │ CATEGORIES  (Help) (Conservation)                                     │ │
│ …                    └───────────────────────────────────────────────────────────────────────┘ │
│ ┌ Keep the torch lit┐  footer: licence · disclaimer · Contact ↗ · Help · Licence & attribution │
│ └ [Start contrib.] ─┘                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
  ← 256 sidebar →← 40 →←───────────── sheet (sheet padding 40) ─────────────→  infobox 288
```

**Tablet, 768 × 1024:**

```
┌────────────────────────────────────────────────────────────────┐
│ (☰) 🔥 Bardic Torch [🔍 Search…          ] Theme [▣|☀|☾] (JD)  │ 64
├────────────────────────────────────────────────────────────────┤
│ Help › Conservation status                                     │
│ Conservation status                                    (h1)    │
│ Read                         Adapted from the original wiki ↗  │
│ ───────────────────────────────────────────────────────────────│
│ Conservation statuses help flag    ┌───── At a glance ───────┐ │
│ works that may need more work to   │ Low risk                │ │
│ preserve them …                    │ Endangered              │ │
│                                    │ …                 264px │ │
│ Low risk                    (h2)   └─────────────────────────┘ │
│ ──────────────────────────────────────────────────────────     │
│ A work is low risk if …                                        │
│ CATEGORIES (Help) (Conservation)                               │
├────────────────────────────────────────────────────────────────┤
│ footer · Contact ↗ · Help · Licence & attribution              │
└────────────────────────────────────────────────────────────────┘
 gutter 24 · sheet full-bleed · no bottom bar · nav in Drawer via (☰), from the left
```

**Mobile, 360 × 800:**

```
┌──────────────────────────────────┐
│ 🔥 Bardic Torch                  │ 56   ← logo + wordmark only
├──────────────────────────────────┤
│ Help › Conservation status       │
│ Conservation                     │
│ status                  (h1 30px)│
│ Read     Adapted from the        │
│          original wiki ↗         │
│ ─────────────────────────────────│
│┌────────────────────────────────┐│
││ At a glance                    ││ ← infobox full width,
││ Low risk · Endangered · …      ││   stacked above prose
│└────────────────────────────────┘│
│ Conservation statuses help flag  │
│ works that may need more work …  │
│ ▸ Contents (details, collapsed)  │
│ Low risk                    (h2) │
│ ─────────────────────────────    │
│ CATEGORIES                       │
│ (Help) (Conservation)            │
├──────────────────────────────────┤
│ footer (stacked lines)           │
│ Contact ↗ · Help · Licence & …   │
│ ░░ body padding = bar height ░░  │
├──────────┬───────────┬───────────┤
│   ☰      │    🔍     │    (JD)   │ 56 + safe-area   ← bottom app bar, fixed
│  Menu    │  Search   │  Account  │   each cell ≥ 44 × 55
└──────────┴───────────┴───────────┘
 gutter 16

Drawer (open, bottom sheet from the bar, max-height 85dvh):
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  scrim
┌──────────────────────────────────┐
│ ── (grab bar, decorative)        │
│ Site menu (h2)              (✕)  │ ← close button gets focus on open
│ [🔍 Search the catalogue…     ]  │
│ BROWSE                           │
│ Pieces                           │  items 44 px tall
│ …                                │  (list scrolls; scroll-padding-bottom
│ HELP …                           │   = sticky bar height)
│ Keep the torch lit [Start]       │
│──────────────────────────────────│
│ Theme [System | Light | Dark]    │ ← sticky bottom, thumb zone
│ [          Close menu          ] │
└──────────────────────────────────┘
```

### 5.9 Logo mark

- **Tag: FE1.** It is an inline SVG component, `<LogoMark className="h-6 w-6" />` (`app/components/LogoMark.tsx`), with `viewBox="0 0 24 24"`. The class sets the size: `h-5 w-5` (20 px), `h-6 w-6` (24), `h-7 w-7` (28), `h-8 w-8` (32), `h-12 w-12` (48) or `h-16 w-16` (64). It is **always decorative** (`aria-hidden="true"`, `focusable="false"`). Wherever it identifies the site, the `Wordmark` component next to it supplies the accessible name as real text ("Bardic Torch"), so the name is never only in an image. It has no stroke, so it stays crisp at small sizes.
- The path data lives in `app/components/logo-mark-paths.ts`. Both `LogoMark` and the favicon generator read it, so the two can't drift.
- **Wordmark** (`app/components/Wordmark.tsx`, FE1): the mark plus the text "Bardic Torch" (§3.2). "Bardic" is `text-fg` and "Torch" is `text-accent-text`. The mark is `text-fg`, so its handle is ink. It renders inline, so the parent decides the semantics: a link to `/` in the header (and on the root error page). Its mark is `h-6 w-6` below `md` and `h-7 w-7` from `md` up.
- **Handle:** a tapered shaft, `fill="currentColor"` (inherits `text-fg`): `M10.6 12.5h2.8l-0.75 9.25a0.9 0.9 0 0 1-0.9 0.75h-0.3a0.9 0.9 0 0 1-0.9-0.75z`.
- **Cresset (the bound head):** `fill="currentColor"`: `<rect x="8.75" y="10" width="6.5" height="2.75" rx="1.1"/>`, plus one binding ring on the shaft, `<rect x="10.1" y="15.25" width="3.8" height="1.1" rx="0.55"/>` (also currentColor).
- **Flame outer:** `class="fill-accent"`: `M12 1.25c2.9 2.6 4.6 4.75 4.6 6.75 0 1.3-0.95 2-2 2H9.4c-1.05 0-2-0.7-2-2 0-1.7 1.1-2.95 2.15-3.75 0.1 1.2 0.65 2.05 1.4 2.4C10.75 4.7 11.15 2.85 12 1.25z`.
- **Flame core:** `class="fill-logo-core"`: `M12.2 4.9c1.35 1.35 2.1 2.45 2.1 3.4 0 0.9-0.95 1.45-2.3 1.45s-2.2-0.6-2.2-1.35c0-0.8 0.55-1.4 1.15-1.7 0.2 0.7 0.6 1.1 1.1 1.2-0.3-1-0.25-2 0.15-3z`.
- `--bt-logo-core` is a decorative token: `#E8A33D` (= accent-glow) in light, where it reads as a bright core inside the burnt-orange outer, and `#F4BA62` (= accent-hover) in dark, a hotter centre inside the bright amber outer.
- The outer flame meets ≥3:1 on every surface in both themes (rows `accent` on `canvas`/`surface`/`surface-raised`/`surface-sunken`).
- At 20 px the core may merge visually; that is fine, because the silhouette carries the mark.
- **Favicon:** `public/favicon.svg` is **generated** by `scripts/build-tokens.mjs` from the same paths and the `tokens.ts` values. Inside the SVG, a `<style>` with a `prefers-color-scheme: dark` block switches the handle between light and dark `fg`, the outer flame between light and dark `accent`, and the core between light and dark `logo-core`. No colour is typed by hand. `site.webmanifest` lists it as the icon (`sizes: "any"`). FE1 ships no raster icons (`favicon.ico`, `apple-touch-icon.png`), because generating them from tokens needs a rasteriser in the toolchain. They are FE2+ work, and browsers without SVG favicon support show their default icon until then.
- Check it on the styleguide at 20, 24, 28 and 32 px on all four surfaces in both themes before you commit.
- **Motion (FE1, header home link only):** on hover, the outer flame plays `flicker`: `scaleY 1 → 1.04 → 0.98 → 1` with `transform-origin: 50% 90%`, 600 ms, one iteration (`motion-safe:group-hover:animate-flicker`). It is disabled under reduced motion.

---

## 6. Components

Generic components live in `app/components/ui/`. App-specific ones (ThemeToggle, LogoMark, Wordmark, AccountMenu, SearchBox, TOC, HelpLinks and so on) live in `app/components/`. Each has a styleguide entry (§10.6) and a `*.test.tsx`. Unless a component says otherwise, the shared rules below apply.

| Component                                  | Tag | FE1 use                                                      |
| ------------------------------------------ | --- | ------------------------------------------------------------ |
| Button (6.2)                               | FE1 | Everywhere                                                   |
| Link (6.3)                                 | FE1 | Everywhere                                                   |
| Field, Input (6.4, 6.5)                    | FE1 | Settings                                                     |
| Textarea (6.6)                             | SG  | None yet                                                     |
| Select (6.7)                               | FE2 | `/pieces` sort, `/bards` affiliation                         |
| Checkbox (6.8)                             | FE2 | Facet filters, kind filters                                  |
| Tabs (6.9): Read label                     | FE1 | Every page head                                              |
| Tabs (6.9): page-link tabs (Read, History) | FE2 | Every entity page; the in-page tablist is SG (theme preview) |
| Infobox (6.10)                             | FE1 | Help pages ("At a glance")                                   |
| Card (6.11)                                | FE1 | Home, help index                                             |
| Chip / TagList (6.12)                      | FE2 | Category chips (overflow, current chip), home chips          |
| ConservationBadge (6.13)                   | FE2 | Piece lists, pages and infoboxes, home card, `/categories`   |
| Alert (6.14)                               | FE1 | Settings, home, noscript notice                              |
| Banner (6.14): page states (PageBanner)    | FE2 | Piece and bard pages (stub, restricted, prefers no page)     |
| EmptyState (6.15)                          | FE1 | No API tokens; no matching pieces (§10.7)                    |
| ErrorState (6.16)                          | FE1 | 404, error boundaries, catalogue failures (§10.7)            |
| Spinner (6.17)                             | FE1 | Button loading                                               |
| Skeleton (6.18)                            | SG  | None in FE1 (SSR pages render real content)                  |
| Breadcrumbs (6.19)                         | FE2 | Help pages and entity pages (collapse at 360 px)             |
| Pagination (6.20)                          | FE2 | Every list and every history                                 |
| Drawer (6.21)                              | FE1 | Navigation <lg                                               |
| Dialog (6.22)                              | FE1 | Revoke-token confirm                                         |
| Toast (6.23)                               | FE1 | Settings feedback                                            |
| ThemeToggle (6.24)                         | FE1 | Header from md; drawer (and the no-JS site menu) below md    |
| AccountMenu (6.25)                         | FE1 | Header / bottom bar                                          |
| SearchBox (6.26)                           | FE2 | Header, drawer, home hero, search page (the catalogue)       |
| TOC (6.27)                                 | FE1 | Help pages with ≥4 h2s                                       |
| FacetForm, FacetDrawer (6.28)              | FE2 | `/pieces`, `/bards`, `/collections` filters                  |
| LetterBar (6.29)                           | FE2 | `/pieces`, `/bards`, `/collections` (§10.7)                  |
| LinkGroups, LicensingCard, Diff (6.30)     | FE2 | Piece and bard pages, revisions                              |
| TermTree (10.12)                           | FE2 | `/categories` (§10.12)                                       |
| LogoMark, Wordmark (5.9)                   | FE1 | Header, footer, EmptyState art                               |
| ContributeCard (5.3)                       | FE1 | Sidebar and drawer                                           |
| HelpLinks (5.7)                            | FE1 | Every footer and the root error page                         |
| Progress indicator (7.1)                   | FE1 | Client navigations                                           |

### 6.1 Shared rules

- **Focus ring (all interactive elements):**
  - `outline: 2px solid rgb(var(--bt-focus)); outline-offset: 2px`, applied on `:focus-visible` only. `app/styles/base.css` applies it to **every** `:focus-visible` element, so components get it without a class; they only adjust the offset (`focus-visible:-outline-offset-2` in dense containers).
  - The ring encloses the whole control: at least a 2 px perimeter at ≥3:1 against the adjacent surface (WCAG 2.4.11 and 2.4.13 friendly). Never set `outline: none` without this replacement.
  - Inside dense containers (tabs, chip rows, nav), use `outline-offset: -2px` so the ring can't be clipped. The inset ring sits on the item's own fill; every such pair is in §2.7. It is never inset on an `accent` or `danger` fill (§2.6).
  - In Windows forced-colours mode, outlines survive. `app/styles/base.css` also has `@media (forced-colors: active)` rules: buttons get `border: 1px solid ButtonText`, the current tab and current nav item (`[aria-current]`) get `outline: 2px solid Highlight`, `aria-pressed="true"` toggles get `outline: 2px solid Highlight`, and checkboxes go back to `appearance: auto` (§6.8). Focus there is a 3 px `CanvasText` outline, and the state outline is `:not(:focus-visible)`, so focusing a pressed, current or selected control visibly changes it (WCAG 2.4.7); without that, the state rule (same specificity, later) drew the same outline focused or not.
- **Faux bold:** `font-synthesis: none` applies only where Fraunces is the face (`h1`–`h3` not set in `font-sans`/`font-mono`, and `.font-display`). Sans text, including headings set in the sans (alert titles, sidebar group headings), keeps the browser's synthesis, so labels and titles at 600 stay bold even where the system sans has no 600 face. Decorative SVG fills (the logo) keep their colours with `forced-color-adjust: auto` defaults, because the mark is `aria-hidden` and the wordmark text carries the meaning.
- **Ids:** every `id` used by `aria-labelledby`, `aria-describedby`, `aria-controls` or `htmlFor` comes from React `useId()`. Never hard-code an id in a component: the styleguide renders many instances on one page, and duplicate ids break the references.
- **Focus not obscured (WCAG 2.4.11):** `html` has `scroll-padding-top: calc(var(--bt-header-h) + 0.5rem)`, and below `md` also `scroll-padding-bottom` for the bottom app bar (§5.2). Scroll containers with a sticky footer (the drawer) set `scroll-padding-bottom` to that footer's height. Toasts never cover the control that triggered them (§6.23). The e2e helper `expectFocusNotObscured` tabs through every journey page and checks this.
- **Tap targets:**
  - Primary touch targets are ≥44 × 44 px below `lg`: header buttons, bottom-bar cells, nav items, buttons `md`/`lg`, tabs, pagination, drawer close, form controls.
  - Every other target meets WCAG 2.5.8: it is **either** at least 24 × 24 px, **or** a 24 px circle centred on it doesn't overlap any other target or its circle. Links inside running text are exempt. Small text links that aren't in a sentence (footer, breadcrumbs, TOC) are **not** exempt, so they get `inline-flex min-h-6 items-center` and `gap-y-2` when they wrap.
- **Hover** applies only under `@media (hover: hover) and (pointer: fine)` (the `hover` variant in `app/styles/app.css`), so touch devices don't get sticky hover.
- **Disabled:** use the native `disabled` attribute on buttons and inputs, with `cursor: not-allowed`. Prefer `aria-disabled="true"` plus a click guard when the control must stay focusable to explain _why_, for example a Save button with a tooltip-free help line.
- **No-JS first:** every action is a `<Form method="post">` or a link. JS adds optimistic UI, `useFetcher` and focus management. The one exception in FE1 is Settings (§10.3): its mutations need JS, and without JS a `<noscript>` Alert says so.
- **Motion:** every transform-based transition or animation class carries the `motion-safe:` variant (§8.3).
- **Icons** are `@tabler/icons-react`: `stroke={1.75}`, size 16 (sm/caption), 18 (body-sm), 20 (body), 24 (header). They are `aria-hidden` unless they are the only content, in which case the parent gets an accessible name.

### 6.2 Button

**Tag: FE1.**

- **Anatomy:** `[icon?] label [trailing icon?]`, with an optional spinner that replaces the leading icon.
- It is a `<button>` (`Button`), or a link styled the same when it navigates (`ButtonLink`: React Router `<Link>` for paths, a plain external anchor with the §6.3 marks for absolute URLs, and a plain `<a href="#id">` for a place on the same page, which keeps the address's query). Never use a `<div>`.

| Size           | Height                                                              | Padding x | Text        | Icon | Radius | Use                                               |
| -------------- | ------------------------------------------------------------------- | --------- | ----------- | ---- | ------ | ------------------------------------------------- |
| `sm`           | 36 px (hit area padded to 44 below `lg` via `::before` inset −4 px) | 12 px     | body-sm 500 | 16   | md     | Toolbars, header, inline                          |
| `md` (default) | 44 px                                                               | 16 px     | body 500    | 18   | md     | Forms, dialogs                                    |
| `lg`           | 52 px                                                               | 20 px     | body 600    | 20   | md     | Hero CTA, mobile primary form submit (full width) |

| Variant            | Rest                                                           | Hover                       | Active                             | Notes                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------- | --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`          | `bg-accent text-accent-fg`, no border, `shadow-1` (light only) | `bg-accent-hover`           | `bg-accent-hover translate-y-px`   | At most one per view region                                                                                                                                                           |
| `secondary`        | `bg-surface-raised text-fg border border-border-strong`        | `bg-surface-sunken`         | `bg-surface-sunken translate-y-px` | Default for most actions                                                                                                                                                              |
| `ghost`            | `bg-transparent text-fg-muted`                                 | `bg-surface-sunken text-fg` | same + `translate-y-px`            | Icon buttons in header, tertiary                                                                                                                                                      |
| `danger`           | `bg-danger text-danger-on`                                     | `bg-danger-hover`           | same + `translate-y-px`            | Destructive confirms only (e.g. "Revoke token"). **Always** has a leading icon (`IconTrash`, or `IconAlertTriangle` when nothing is deleted) and a verb label.                        |
| `secondary-danger` | `bg-surface-raised text-danger-fg border border-danger-icon`   | `bg-danger-bg`              | same + `translate-y-px`            | The _trigger_ that opens a destructive confirm ("Revoke"). Its edge is `danger-icon`, which is ≥3:1 on every surface; `danger-border` would be only about 2:1. Also carries the icon. |

- **States:**
  - **focus-visible:** the shared ring.
  - **disabled:** `bg-surface-sunken text-fg-subtle border border-border`, with no shadow, for every variant.
  - **loading:** set `aria-busy="true"`, keep the label, swap the leading icon for a 16 px `Spinner`, and set `aria-disabled="true"` (the button stays focusable, and repeat submits are ignored). The spinner shares one grid cell with the (now invisible) leading icon, so the width can't change and the button doesn't jitter. That is why only a button **with** a leading icon can be `loading` (the `Button` props enforce it); a `min-width` lock would need an inline style, which the CSP forbids. Screen readers hear the label plus a live "Saving…" from the form's status region, not from the button.
  - **selected:** for toggle buttons, set `aria-pressed="true"`, use `bg-accent-subtle text-accent-text border-border-strong`, and add a check icon only if the label alone is ambiguous.
- **Heights are minimums** (`min-h-9`/`min-h-11`/`min-h-13`), so a label under the WCAG 1.4.12 text-spacing override grows the button instead of overflowing it.
- **Forced colours:** every variant has a 1 px border (`border-transparent` on fills), which Windows High Contrast paints in the system colour, so filled buttons and button-styled links keep an edge.
- **Icon-only buttons:** square, at the height of their size (36/44/52). They must have `aria-label`. Use `ghost` by default. A `title` is not a substitute for the label.
- **Dark mode notes:** primary is a light amber fill with dark text, and danger is a light crimson-pink fill with dark text. Shadows come from the `shadow-*` tokens, which are nearly invisible in dark.
- **Primary vs danger:** the fills differ by ≥30° of hue (§2.4), and danger buttons always have an icon, so the two are distinguishable by more than colour.
- **Keyboard:** Enter and Space activate, as native.

### 6.3 Link

**Tag: FE1.**

| Kind                                                | Style                                                                                                                                                                                                             | Notes                                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Internal, in prose                                  | §3.3 prose link (underlined, lapis, visited purple)                                                                                                                                                               | React Router `<Link prefetch="intent">`                                                                              |
| Internal, standalone / UI (card titles, "View all") | `text-link font-medium`, no underline at rest, underline on hover and focus-visible                                                                                                                               | Only in navigational containers (§2.6)                                                                               |
| External                                            | As above, plus trailing `IconExternalLink` 0.85em `text-fg-subtle` (`aria-hidden`) plus `<span class="sr-only"> (external link)</span>`. Or, for old-wiki links, `IconArrowUpRight` plus "(opens original wiki)". | `rel="noopener"`, no `target="_blank"` by default. User-supplied URLs (`userContent`) also get `rel="nofollow ugc"`. |
| Muted                                               | `text-fg-muted underline decoration-fg-subtle-50`                                                                                                                                                                 | Footer, meta lines                                                                                                   |

- **States:** hover is `text-link-hover` with a 2 px decoration. Focus-visible is the shared ring with `rounded-sm` and `outline-offset: 2px`. Active (pressed) matches hover. There is no disabled link: render plain text instead.
- **Current page** links in body text (rare) get `aria-current="page"` and `font-semibold text-fg no-underline`.
- **Component:** `Link` (`to`, `appearance` prose | standalone | plain | muted | inherit, `current`, `compact`, `userContent`). `userContent` marks a URL that came from the API (a reader added it): it is typed to an absolute `` `http${string}` `` URL, always renders as an external anchor, and gets `rel="nofollow ugc noopener"`. Every API-supplied URL goes through it. `plain` is standalone at the surrounding weight (breadcrumbs, the contents list). `compact` gives a link outside running text a 24 px tall target (`inline-flex min-h-6 items-center`): the footer's help links and the breadcrumbs. The TOC's in-page anchors take the same look from `linkClasses`.

### 6.4 Field pattern (label, help, error)

**Tag: FE1** (Settings). The error summary is **SG**.

```
Label text  (optional)                ← <label for> body-sm 600 text-fg; "(optional)" fg-subtle 400
Help text that explains format.       ← caption text-fg-muted, id="{id}-help"
┌───────────────────────────────┐
│ value                         │     ← control
└───────────────────────────────┘
⚠ Error message in plain words.       ← caption 500 text-danger-fg + IconAlertCircle 16 danger-icon, id="{id}-error"
```

- The control's `id` comes from `useId()` (§6.1), and the help and error ids derive from it. When something else links to the control (the error summary), the parent calls `useId()` and passes it as `Field id`.
- The error line starts with a visually hidden "Error: ", so the description says what kind of message it is.
- Mark _optional_ fields, not required ones, because most fields are required. Required controls also get the `required` attribute and `aria-required="true"`.
- The control has `aria-describedby="{id}-help {id}-error"`, listing only the ids that exist. In the error state it gets `aria-invalid="true"`.
- **Error summary** (SG; FE1's forms have one field each): a danger Alert at the top of the form with the heading "Check {n} thing(s) below" and in-page links to each field.
  - **Without JS** (server re-render), nothing can move focus. The summary is rendered first in the form with `role="alert"`, so the page load announces it, and the first invalid field gets `autoFocus`.
  - **With JS,** focus moves to the summary (`tabindex="-1"`) after a failed submit.
  - Component: `ErrorSummary` (`app/components/ui/ErrorSummary.tsx`), given `problems: [{fieldId, message}]`, where `fieldId` is the `id` the parent passed to each `Field` (from its own `useId()`). It takes focus when it mounts, whenever the problems change, and whenever its `attempt` (the form's count of failed submits) goes up, so a resubmit with the same problems is announced again; not on other re-renders. Each link is `href="#{fieldId}"`; with JS a click also focuses the control (an in-page link alone only scrolls).
- FE1's Settings fields show their server error inline under the field (`aria-invalid`, `aria-describedby`), and focus moves to the field.
- **With JS,** validate on blur after the first submit attempt, and never on every keystroke before the first submit.
- There is a 4 px gap between label and help, 8 px between help and control, 6 px between control and error, and 20 px between fields.

### 6.5 Input

**Tag: FE1.**

- **Rest:**
  - `h-11` (44 px), `px-3`, `bg-input-bg`, `text-fg body`, `border border-border-strong rounded-md`, placeholder `text-fg-subtle`.
  - The background is `bg-input-bg`, an alias token: `surface-raised` in light and `surface-sunken` in dark (§2.3). No `dark:` class is needed.
- **Hover:** `border-fg-subtle`.
- **Focus-visible / focus:** the shared ring. The border stays put, so there is no shift.
- **Disabled:** `bg-input-bg-locked text-fg-subtle border-border`. **Read-only:** `bg-input-bg-locked` with the strong border kept but **dashed**, and `text-fg`. All three states (rest, read-only, disabled) differ in both themes: in dark the locked fill is `surface`, a step up out of the `surface-sunken` well.
- **Error:** a 2 px `danger-icon` edge, plus the message: the 1 px `border-danger-icon` plus an inset 1 px `ring-danger-icon` inside it, so neither the padding nor the content moves.
- **Loading** (FE2+, async check, e.g. duplicate name): a 16 px trailing Spinner inside, `aria-busy` on the field wrapper.
- Use `type` correctly (`email`, `url`, `search`) and set `autocomplete`. Never use placeholder as the label.
- Leading and trailing icon slots are 20 px with `pl-10`/`pr-10`. Icons are `text-fg-subtle`.

### 6.6 Textarea

**Tag: SG.** The counter is **FE2+**.

- Same as Input, with `min-h-textarea` (a named config value: 7.5rem, 120 px = 5 lines), `py-2.5`, `resize: vertical`, `leading-relaxed`.
- **Optional counter (FE2+):** `caption text-fg-subtle` right-aligned below. At ≥90 % of the limit it turns `text-warning-fg`, and over the limit `text-danger-fg` plus error. The counter is announced via `aria-describedby` and is not a live region. A polite "{n} characters left" is announced only at 20, 10 and 0.

### 6.7 Select

**Tag: FE2** (`/pieces` sort, `/bards` affiliation).

- Use a native `<select>` styled like Input: `appearance-none pr-10`, with an `IconChevronDown` 18 `text-fg-muted` absolutely positioned, `pointer-events-none`.
- No custom listbox in FE1. Options inherit the OS picker. Set `color-scheme` so the dropdown matches the theme.
- States are the same as Input.

### 6.8 Checkbox

**Tag: FE2** (the facet and kind filters; FE1 had it as SG).

- Use a native `<input type="checkbox">` with `appearance: none`: 20 × 20 px, `rounded-sm`, `border-2 border-border-strong`, `bg-surface-raised`.
  - **Checked:** `bg-accent border-accent`, with an `IconCheck` (stroke 3) in `accent-fg` laid over the box (`pointer-events-none`, shown by `peer-checked:`). An overlaid SVG rather than a CSS mask keeps the tick a token colour and needs no data URI.
  - **Indeterminate:** a horizontal bar (`IconMinus`, `peer-indeterminate:`).
- Wrapped in a `<label>` with the text, the whole row is the hit area: min height 44 px below lg, 32 px at ≥lg, with `gap-3`. Help text sits under the label text, indented to the text.
- **States:**
  - Hover: border `fg-subtle`.
  - Focus-visible: the ring around the box only.
  - Disabled: `bg-input-bg-locked border-border-strong`, check `fg-subtle`, label `fg-subtle`.
  - Error: border `danger-icon`, plus the field error message below the group.
- **Groups:** `<fieldset>` with `<legend>` styled as a field label.
- **Radio** (`app/components/ui/Radio.tsx`, FE2): the same row, hit area and states with a round box (`rounded-full`), checked as an `accent` border around a 10 px `bg-accent` dot (`peer-checked:block`); forced colours as above. Radios sharing a `name` go in a fieldset with a legend.
- **Forced colours:** a token-drawn check is not reliable in Windows High Contrast, which would make checked and unchecked look the same. So the box carries `forced-colors:appearance-auto`, handing it back to the system control, and the overlaid marks carry `forced-colors:hidden!` (important, because `peer-checked:block` is more specific than a media-query utility). (A utility, not only the `base.css` rule: `appearance-none` is a utility, and the base layer can't override it.)

### 6.9 Tabs

**(a) Page tabs: Read / Edit / History** (**FE2**: Read and History are wired on every entity page; Edit is FE3). These are wiki navigation, so they are **links**, not a tablist.

```
Read   Edit   History                         Last edited 3 Oct 2026
▔▔▔▔
────────────────────────────────────────────────────────────────────  ← title rule (1px border)
```

- **Markup:** `<nav aria-label="Page views"><ul class="flex">` with `<li><Link aria-current="page">`.
  - Icons: `IconBook2` (Read), `IconPencil` (Edit), `IconHistory` (History), at 18 px. At <sm the icon is shown with its text, and the text never hides.
- **Tab:**
  - `h-11 px-3 body-sm font-medium text-fg-muted`, flush on the rule (`-mb-px`) with a transparent 3 px bottom border.
  - Hover: `text-fg`, plus a 3 px `border-border-strong` bottom bar.
  - **Current** (`aria-current="page"`): `text-fg font-semibold`, plus a 3 px `accent` bottom bar.
  - Focus-visible: inset ring (`-outline-offset-2`), `rounded-t-md`.
- **Edit** (FE3) goes to the edit route. For signed-out users it goes to `/auth/login?returnTo=…`, and the tab still reads "Edit". Never hide the tab on an editable page.
- **Pending state** (FE3): when the viewer has a pending revision, the Edit tab shows a 8 px `pending-icon` dot plus `sr-only` " (you have a pending edit)".
- The `nav` version is used only when a page has **two or more** views.

**(a′) Single-view label: "Read"** (**FE1**, every FE1 page head). A `nav` landmark holding one self-link would add a landmark and a tab stop that do nothing. So pages with one view (every FE1 page) render the same visual shape without interaction: `<span aria-current="page">Read</span>` (with its icon) sitting on the title rule with the 3 px `accent` bar, and no `nav`, no list and no link. Screen readers read it as plain text.

- The row never wraps. It is **not** a scroll container: a scroller would clip the tabs' `-mb-px` overlap onto the title rule, and the three views (Read, Edit, History, with icons) fit in 320 px. The page meta at the right of the rule goes under the tabs instead: below sm the rule is drawn under the tabs alone (the meta sits beneath it), and from sm under the whole row, so the current tab's bar is always on the rule.
- Component: `ViewTabs` (`app/components/ui/Tabs.tsx`) renders the whole row, the rule included, with an optional `meta` slot; one view gives the a′ label, two or more the `nav`.

**(b) In-page tablist** (**SG**: the styleguide's theme preview uses it; no FE1 page does):

- `role="tablist"` with `aria-label`. Each `role="tab"` has `aria-selected`, `aria-controls` (ids from `useId()`), and roving `tabindex` (0 on the selected tab, −1 on the others). Each panel is `role="tabpanel"` with `tabindex="0"` and `aria-labelledby`.
- **Keyboard:** Left and Right move _and activate_ (automatic activation, because panels are cheap). Home and End jump. Tab moves into the panel.
- **Visual:** a segmented style to distinguish it from page tabs. The track is `bg-surface-sunken rounded-lg p-1`, each tab is `h-9 rounded-md body-sm`, and the selected tab is `bg-surface-raised text-fg shadow-1 border border-border-strong` (the strong edge gives it 3:1 against the track, WCAG 1.4.11; the fill and shadow alone did not).
- **No-JS:** render all panels stacked, each in a `section` under its heading, and hide the tablist. The server renders it with `hidden` (attribute and class, since a display utility would beat the attribute) on the tablist until hydration flips `data-enhanced`; then the panels become `role="tabpanel"` and the headings go (the tab names the panel).
- **Lazy panels** (`lazy`): for panels too heavy to keep in the page together (the styleguide preview). Only the selected panel has content; the others are empty hidden `tabpanel`s, so every `aria-controls` resolves. Without JS only the default panel is rendered, under its heading.
- **Forced colours:** the selected tab (`aria-selected="true"`) gets the same `Highlight` outline as `aria-current` and `aria-pressed` (base.css).

### 6.10 Infobox

**Tag: FE1** (static content). Loading and error states are **SG**. "Edit facts" is **FE3**.

- **Anatomy:** an `<aside aria-labelledby={titleId}>` (`titleId` from `useId()`) containing:
  - a 3 px `accent` top cap (`border-t-3`)
  - the title: an **`h2`** styled as h3 (Fraunces, `text-h3`). The infobox comes first in the DOM, before the page's first prose `h2`, so an `h3` here would break the outline (h1 → h3 → h2).
  - an optional subtitle (caption, fg-muted)
  - sections, each with an **`h3`** heading styled `label-caps`, and a `<dl>`
  - an optional footer action, e.g. "Help complete this page" or "Edit facts"
- **Style:** `bg-surface-raised border border-border rounded-lg shadow-1`, padding 16 px. The `dl` uses rows: `dt` is `body-sm text-fg-muted` and `dd` is `body-sm text-fg`, in a 2-column grid `7rem 1fr` where the box is wide: full width at sm–md, and the 20rem float from xl. In the 16.5rem float at md–xl the label stacks over its value (as below sm), since a 7rem label column left the values 1–3 words a line. Rows have `py-2 border-b border-border`, and the last row has none.
- **Values are fragments:** no terminal full stop, which would also follow a link's ↗ mark.
- **Values** may be links (standalone link style), chip lists (TagList `sm`), or a ConservationBadge.
- **Empty value:** an em dash "—" `text-fg-subtle` with `sr-only` "Not recorded". Empty _sections_ are omitted entirely.
- **Loading:** Skeleton rows (3 × 2 bars). **Error:** an inline danger text row, "Couldn't load these details. [Try again]".
- **Dark:** `surface-raised` sits one step above the sheet, with the border kept. The accent cap stays.
- Placement is in §5.5.

### 6.11 Card

**Tag: FE1** (both variants).

- The card is a `div` with a heading, `bg-surface border border-border rounded-lg p-4 md:p-5 shadow-1`. It is not an `<article>`: cards always sit in a list item (below), which with the heading already gives the structure, and an article role would only add an announcement per card. The `shadow-1` token is a faint inner highlight in dark, so no `dark:` class is needed.
- **Anatomy:** an optional eyebrow (`label-caps text-fg-subtle`), a title (h3), body (body-sm fg-muted), and a meta row (caption fg-subtle, badges). The body is **not** clamped: `line-clamp` hides text under the WCAG 1.4.12 text-spacing override, and card copy is short by design (≤ 3 lines at rest).
- **Variants:**
  - `static` (the home "Why" cards): no link, no hover and no focus ring. The title is a plain h3.
  - `link` (the help index): the title is the link, and the whole card is clickable (below).
- **Lists of cards** are a `<ul role="list">` with each card inside an `<li>` (`CardList`). Cards are never loose boxes without list semantics. One column, two from md, three from lg (an odd last card spans both columns at md, so the home page's three Why cards leave no empty half row); `columns={2}` stops at two (its odd last card spans both from md), for a list inside the prose measure (the help index), where three would squeeze the titles. The list carries `not-prose` (§3.3), so `.prose-bt` never adds bullets, list indents, heading margins or underlines to its cards. ESLint's `jsx-a11y/no-redundant-roles` is configured to allow `role="list"` on `ul`/`ol` for this reason.
- **Whole-card link** (`link` variant): the title `<a>` gets `after:absolute after:inset-0`, and the card is `relative`. Secondary links inside get `relative z-10`. Hover gives `border-border-strong` and a title underline. Focus-visible puts the ring around the card by drawing it on the title link's `::after` (which already covers the card, `after:rounded-lg`), and the link's own outline is removed; `:has()` on the card would need an arbitrary variant. A link card has no other links inside.
- Cards don't nest.

### 6.12 Chip / TagList (category chips)

**Tag: FE2.** The current-chip state (a category's own page) and the overflow ("Show all {n}" past 12) are built in FE2.

- The list is `<ul class="flex flex-wrap gap-2" role="list">`, and each item is a link chip.
- **Chip:**
  - `inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken text-link body-sm font-medium px-3`, with height 32 px (`sm`: 28 px, used in the infobox). Below lg, `md` chips have a 44 px hit area via padding (height 36) plus row gap 8.
  - The optional facet prefix sits in `text-fg-muted font-normal`, for example "Mood:" + "Singalong".
- **States:**
  - Hover: `bg-accent-subtle border-border-strong text-link-hover`.
  - Focus-visible: the ring.
  - Current (on its own term page): `aria-current="page"`, `bg-accent-subtle text-accent-text border-accent`. The focus ring is inset here, on `accent-subtle` (§2.7).
  - Disabled does not exist.
- **External chips** (a chip to another site) get a trailing external mark, `IconArrowUpRight` 14 plus `sr-only` "(external link)" ("(opens original wiki)" for the wiki). No FE2 page renders one: every chip is an internal category or filter link.
- **Empty:** if a page has no categories, show `caption text-fg-subtle` "No categories yet." with an Edit link for editable pages (FE3).
- **Overflow:** more than 12 chips collapse behind a "Show all {n}" ghost `sm` button under the list (a disclosure: `aria-expanded`, `aria-controls` on the list). Pressing it shows the rest and relabels it "Show fewer"; focus stays on the button. The hidden chips are `hidden`, so Tab skips them. Without JS, and before hydration, all chips are shown and there is no button.

### 6.13 ConservationBadge

**Tag: FE2.** The tokens (§2.5) and contrast rows exist already. FE1 pages name statuses in text: the conservation help page uses a table, and the home card links to that page.

- **Anatomy:** a pill, `[icon] Label`, with `bg-cons-{s}-bg text-cons-{s}-fg border border-cons-{s}-border rounded-full`. The icon is in `text-cons-{s}-border`. See §2.5 for the per-status values; critically endangered gets a 2 px border, and unassessed gets a dashed border.
- **Sizes:** `sm` is 24 px high, `px-2 caption gap-1`, icon 14. `md` is 28 px, `px-2.5 body-sm font-medium gap-1.5`, icon 16.
- **Semantics:**
  - Static by default: `<span>`, with the visible text as the label.
  - When it is a link to `/help/conservation-status#{anchor}`, the accessible name is "Conservation status: Endangered".
  - Also add `sr-only` "Conservation status: " before the label wherever the context doesn't already say so (outside the infobox row labelled "Conservation").
- **States:** hover (link variant only) adds an underline on the label. Focus-visible is the ring. There are no other states.
- **Restricted** never appears alongside "help preserve this" prompts. The page template suppresses them (R-7).
- **Forced colours:** the border keeps its width and style (1 px, 2 px for critically endangered, dashed for unassessed) in the system colour, and the icon and label stay, so the status still reads.
- **Component** (`app/components/ui/ConservationBadge.tsx`): `ConservationBadge` (`status`, `size` sm | md, `link`, `named`). `link` makes it a link to `/help/conservation-status#{status}`, whose table row id is the hyphenated status (`#critically-endangered`, FE1's anchors; one typed map in `app/constants/vocabulary.ts`; §3.3). `named` drops the hidden prefix where the context already says "Conservation". Labels and the status list are in `app/constants/vocabulary.ts` (`CONSERVATION_LABELS`, a `Record` over the enum).
- **Dark:** tints over charcoal. The icon colour is lighter and less saturated, and text is near-vellum.

### 6.14 Alert / Banner

**Tag:** Alert **FE1**. Banner **FE2** (the page states; the pending banner is FE3). There is no dismissible variant (see below).

- **Anatomy:** `[icon 20] [title (body 600)] [body (body-sm)] [actions]`. It is `flex gap-3 p-4 rounded-lg border bg-{s}-bg border-{s}-border text-{s}-fg`, the icon is `text-{s}-icon`, and links inside use `text-{s}-fg underline`.
- **Variants:** see the table below.
- **Placement:** an _Alert_ is inline in content. A _Banner_ is full sheet width under the tab row (page-level states: stub, restricted and prefers no page in FE2; pending in FE3). It uses the same component with `variant="banner"`: `rounded-none border-x-0` on mobile, `rounded-lg` at ≥md.
- **Semantics:**
  - Static alerts rendered with the page are **not** live regions: a plain `<div>` with an `<h2 class="sr-only">` or a visible title.
  - Alerts injected after an action use `role="status"` (info, success, pending) or `role="alert"` (danger, and warning when blocking). Mount the container empty first, so the announcement fires.
- **No dismissible variant in FE1.** No FE1 alert needs dismissing, and dismissal without JS would need a route and a cookie the plan doesn't have. If a later milestone adds one, it must add the route, the cookie (with its flags tested) and the no-JS form to the plan first. **Danger and pending alerts are never dismissible.**
- Links inside alerts use `text-{s}-fg underline`, and their focus ring sits on `{s}-bg` (pairs in §2.7).
- **Components** (`app/components/ui/Alert.tsx`): `Alert` (`tone`, optional `title`, body, `actions`, `banner`, `icon`, `headingLevel`) and `AlertRegion` (an always-mounted `role="status"`, or `role="alert"` with `urgent`). Every tone has a distinct icon and a hidden tone name ("Warning: ") before the words.
- **Page states** (`app/components/PageBanner.tsx`): `PageBanner` with `kind` `stub` (`subject` piece | person), `restricted` or `no-page` (`name`), each an info `Alert banner` with the §7.5 wording. Restricted swaps in `IconLock`. Restricted and no-page take an optional `statementUrl`, shown as "Read their statement" (a `userContent` link, §6.3) only when the API has one; with none there is no action row. The stub's action is "How to contribute" (`/help/contributing`) until editing exists (FE3).

| Variant        | Icon                | Typical title                   |
| -------------- | ------------------- | ------------------------------- |
| info           | `IconInfoCircle`    | "This page is a stub"           |
| success        | `IconCircleCheck`   | "Display name saved"            |
| warning        | `IconAlertTriangle` | "This link may be broken"       |
| danger (error) | `IconAlertCircle`   | "We couldn't save your changes" |
| pending        | `IconHourglass`     | "Waiting for approval"          |

### 6.15 EmptyState

**Tag: FE1.**

- **Anatomy:** centred within its container, `py-12 px-4`, `max-w-md mx-auto text-center`. It contains:
  - a 48 px illustration: the logo mark in an outlined "unlit" variant, with the handle `fg-subtle` and the flame as a 1.5 px `border-strong` outline, no fill
  - a title (h3)
  - a body (body-sm fg-muted, ≤2 sentences)
  - one primary or secondary action
- **Semantics:** a plain `<section aria-labelledby>` (id from `useId()`). It is not live. (When it replaces search results, the results-count status region announces "No results".)
- **Components:** `EmptyState` (`title`, body, `action`, `headingLevel` 3 by default) and its art `UnlitMark` (`app/components/LogoMark.tsx`): the handle and cresset `fill-current text-fg-subtle`, the flame `stroke-border-strong` with `vector-effect: non-scaling-stroke`, so the outline is exactly 1.5 px at every size.

### 6.16 ErrorState

**Tag: FE1.**

- **Inline / section** (a region failed to load): Alert danger, with a short title, the cause if known, and "Try again" (secondary `sm`, which revalidates via `useRevalidator`, or a reload link without JS).
- **Page:** see §10.5. The illustration is the unlit torch (as above) with the outer flame dashed. The title is h1. When Sentry is configured, it includes a reference in `caption font-mono text-fg-subtle`, "Reference: 7f3a…": the Sentry `eventId` returned by `captureException` (`useErrorReference`). Without Sentry, the reference line is omitted. (The boundary can't read response headers, so there is no request id to show.) Actions: "Go to the home page" and "Try again".
- Never show a stack trace, raw status text or JSON.
- **Components** (`app/components/ui/ErrorState.tsx`):
  - `TryAgain` (`variant`, `size`): with JS a Button that calls `useRevalidator().revalidate()` and is `loading` while the loaders run (a successful revalidation also clears an error boundary). In the server render and before hydration it is a `ButtonLink reloadDocument` to the current path and query, so it works without JS.
  - `SectionError` (`title`, cause): the inline form, a danger Alert with a `sm` TryAgain.
  - `UnderPageHead`: wraps the error a child route shows under its layout's head (a category's members, a history), so its heading is an `h2` (`text-h2`) and the page keeps its one `h1`. An error that replaces the whole page keeps the `h1`.
  - `ErrorState` (`title`, body, `reference`, `actions`, `art`): the page form. `art="broken"` (default) is the UnlitMark at 64 px with a dashed outline; `art="missing"` (404, §10.4) is the plain unlit torch at 64 px. When it mounts after hydration (an error during a client navigation), focus moves to the h1 (`tabindex="-1"`); a server-rendered error page leaves focus alone.

### 6.17 Spinner

**Tag: FE1.**

- An SVG 16/20/24 px circle: track `stroke-border` and arc `stroke-accent` (75 % dash), stroke width 2 (16 px) or 2.5. It rotates 800 ms linear, infinite.
- **Semantics:** `aria-hidden="true"` always. The _container_ conveys the busy state (`aria-busy`, or adjacent `role="status"` text "Loading…" / "Saving…").
- **Reduced motion:** no rotation (`motion-safe:animate-spin`). The arc pulses opacity 1 → 0.4 at 1.2 s instead (`motion-reduce:animate-pulse-soft`, an opacity-only animation, which is allowed as non-vestibular). The text label is always there.
- **Use only for:** actions under 10 s that have no layout to predict (button loading, inline async checks). Pages and regions use Skeleton (§7.1).

### 6.18 Skeleton

**Tag: SG.**

- Blocks of `bg-surface-sunken rounded-md`. Text lines are `h-text-line` (a named value, 0.75em) at their text style, so line height is preserved, with widths 100 %, 92 % and 60 % for the last line. The heading line is `h-8 w-2/3`, and chips are `h-8 w-20 rounded-full`.
- **Shimmer:** a 1.6 s linear gradient sweep, `linear-gradient(90deg, transparent, rgb(var(--bt-surface-raised) / var(--bt-shimmer-alpha)), transparent)`, where `--bt-shimmer-alpha` is a token (0.6 light, 0.35 dark). It runs only under `motion-safe:`; under reduced motion it is static.
- **Semantics:** the region wrapper has `aria-busy="true"`, and one `sr-only` "Loading {thing}…". Skeleton blocks are `aria-hidden`.
- It must reserve the **exact** final dimensions (no CLS on swap). Skeletons exist only for client transitions. SSR pages render real content.

### 6.19 Breadcrumbs

**Tag: FE2.** The collapse (past three crumbs at 360 px) is built; FE1's crumbs were two deep.

- `<nav aria-label="Breadcrumb"><ol>` containing links, with the last item `<span aria-current="page">` in `text-fg-muted`, not a link. The separator is `IconChevronRight` 14 `text-fg-subtle aria-hidden`, an inline SVG in a `separated-list-mark` that starts every item (CSS `::before` can't draw a token-coloured Tabler icon without a data URI). The `ol` is a `separated-list separated-list-tight` (§5.7): the chevron that would start a line is clipped, so when the trail wraps no chevron dangles at either end of a line. Text is caption, links are `text-link` with no underline (underline on hover), and each link is `inline-flex min-h-6 items-center` (§6.1, WCAG 2.5.8).
- Component: `Breadcrumbs` (`trail: [{label, to}, …]`, `current`), `ol role="list"` with `gap-y-2`.
- **Below sm:** when there are more than 3 items (the page included), the ancestors between the first and the parent collapse to "…" (a button, `aria-label="Show full path"`, `aria-expanded="false"`, a 24 px target). Pressing it shows the whole trail, removes the button and moves focus to the first crumb it revealed. From sm the whole trail shows and the button is hidden (`sm:hidden`, the collapsed items `max-sm:hidden`). Without JS, and before hydration, the full trail wraps instead.
- Shown on help pages ("Help › …") and later on term pages. Not shown on Home.

### 6.20 Pagination

**Tag: FE2** (every list and history; FE1 had it as SG).

- `<nav aria-label="Pagination">` containing: "Previous" (`IconChevronLeft` + text), page numbers, and "Next". These are links with `?page=n`.
- **Items:** `min-w-11 h-11 rounded-md body-sm` (44 px). The current page is `aria-current="page"`, `bg-accent text-accent-fg font-semibold`, and is a `span`, not a link, so it never takes focus (an inset ring on `accent` would be invisible, §2.6). Hover is `bg-surface-sunken`.
- **Ellipsis:** `…` in `text-fg-subtle aria-hidden`, with a hidden "more pages".
- **<sm:** only "Previous", "Page 3 of 12" (body-sm, fg-muted) and "Next". Prev and Next become 44 px icon buttons with visible text kept at ≥360 px.
- **Disabled prev/next** (first or last page): render a `<span aria-disabled="true">`, not a link: `text-fg-subtle cursor-not-allowed` with **no fill**, so it is lighter than the live steps and unlike their `surface-sunken` hover.
- **Keyboard:** standard Tab order.
- Component: `Pagination` (`page`, `pageCount`, `href(n)`). It shows the first page, the last, and the current page with its neighbours; a gap never stands for a single page (that page is shown instead). Number links read "Page 4" (a hidden "Page " prefix). Items are `min-h-11 min-w-11`, minimums so the text-spacing override can grow them. Previous and Next carry `rel="prev"`/`rel="next"`.

### 6.21 Drawer (mobile and tablet nav)

**Tag: FE1.**

- **Element:** native `<dialog aria-labelledby={titleId}>` (id from `useId()`), opened with `showModal()`. This gives a top layer, an inert background and Escape for free. The title is a visible h2 "Site menu".
- **Where it opens: nearest its trigger.**
  - **<md** (trigger in the bottom app bar): a **bottom sheet**. Full width, `max-height: 85dvh`, `bg-surface-raised rounded-t-xl shadow-3 border-t border-border`, `padding-bottom: env(safe-area-inset-bottom)`, with a decorative grab bar at the top.
  - **md–lg** (trigger at the top left of the header): the left edge, full height (`100dvh`), width `w-drawer` (`min(20rem, 85vw)`), `bg-surface-raised rounded-r-xl shadow-3 border-r border-border`.
  - The backdrop is the scrim in both cases.
- **Contents:**
  - **Top:** the title and a close button (ghost icon 44, `IconX`, "Close menu").
  - **Then:** a full-width SearchBox, the nav (§5.3) and ContributeCard. This part scrolls.
  - **Sticky bottom:** below md the ThemeToggle with its visible label "Theme" (from md the header has the page's one toggle, §6.24, so the drawer doesn't repeat it), and a secondary full-width "Close menu" button, in the thumb zone. The scrolling part has `scroll-padding-bottom` equal to this bar's height, so a nav item reached by Tab is never hidden behind it (WCAG 2.4.11).
- **Behaviour:**
  - The menu button has `aria-haspopup="dialog"` and `aria-controls`. It has no `aria-expanded`: once the modal is open, the trigger is inert and can't be read anyway.
  - **On open, focus goes to the close button**, which has `autoFocus`. That is predictable, and screen-reader users hear the dialog's name first. Native `showModal()` would otherwise focus the first focusable element, so the `autoFocus` is what makes this explicit.
  - On close (Escape, either close button, backdrop click, or navigation), focus returns to the menu button.
  - Body scroll is locked (`overflow: hidden` on `html`) while it is open.
  - It closes automatically on route change, and when the viewport reaches `lg`.
- **Motion:** the bottom sheet slides up from `translateY(100%)` and the side drawer from `translateX(-100%)`, over 240 ms with `--bt-ease-out`. The scrim fades over 180 ms. Movement is `motion-safe:` only; under reduced motion it fades, 120 ms. **Closing is instant in FE1** (no exit animation): a native `<dialog>` leaves the top layer as soon as `close()` runs, and delaying that to animate would delay the focus return as well.
- **No-JS:** the menu button is `<a href="#site-nav">`. The fallback navigation renders **after `</main>` and before `<footer>`**, not inside main, so it doesn't pollute the skip-link target. It is the same single `<nav aria-label="Site" id="site-nav">` that the persistent sidebar uses at ≥lg (one element, placed by CSS), headed by the SearchBox and an h2 "Site menu", so there is never a second Site landmark. With JS, that fallback copy below lg is `hidden`, and the button becomes a `<button>`.
- **Component:** `Drawer` (`app/components/ui/Drawer.tsx`; `open`, `onClose`, `title`, `closeLabel` "Close menu", body, `footer`, `closeFrom="lg"`), built on `useModalDialog` (shared with Dialog).
  - The dialog is a flex column: grab bar (<md, decorative `bg-border-strong`), title row, a scrolling body (`min-h-0 flex-1 overflow-y-auto`) and the footer. The footer sits **outside** the scroller rather than over it, so nothing in the body can scroll under it and no `scroll-padding-bottom` is needed.
  - The bottom sheet's padding is `pb-safe-b` (`env(safe-area-inset-bottom)`, a named padding value).
  - Focus goes to the close button through a ref after `showModal()`. React's `autoFocus` calls `focus()` during commit, before the dialog is shown, and doesn't render the attribute that native dialog focusing reads.
  - It closes on any navigation (`useLocation().key` changes) and, with `closeFrom="lg"`, when `(min-width: 1024px)` starts to match; C5's nav drawer passes it. `closeFrom="xl"` (`(min-width: 1280px)`) is the facet drawer's (§6.28).

### 6.22 Dialog

**Tag: FE1** (the revoke-token confirm).

- **Element:** native `<dialog>` with `showModal()`, `aria-labelledby` (title) and `aria-describedby` (body, when it is short), with ids from `useId()`.
- **Size:** `w-dialog` (`min(32rem, calc(100vw - 2rem))`), `bg-surface-raised rounded-xl shadow-3 border border-border p-6`. The title is h2 styled `text-h3` Fraunces.
- **Actions:** right-aligned at ≥sm, in the order [secondary Cancel] [primary/danger Confirm].
  - **At <sm they stack full width, with Cancel at the bottom** (nearest the thumb) and the confirm button above it, 8 px apart. The safe action is the easiest to reach, and the destructive one takes a deliberate reach.
- **Focus:**
  - On open, focus goes to the **least destructive** control (`autoFocus`): Cancel for confirms, or the first field for forms.
  - The rest of the page is inert (native). Tab and Shift+Tab also wrap round inside the dialog (a keydown handler), because native modals let Tab leave the last control for the browser's own UI, and that also covers a browser without `inert`.
  - On close, focus **returns to the invoking element**, which is stored before `showModal`. If the invoker no longer exists (e.g. a row deleted), focus goes to the list's heading (`tabindex="-1"`).
- **Dismissal:** Escape and the close icon button (top right, 36 px, "Close") both work. A backdrop click closes _non-destructive_ dialogs only. While a submission is pending, Escape is ignored and the buttons show loading.
- **Destructive confirm copy:**
  - Title: "Revoke this token?"
  - Body: "Anything using 'Laptop MCP' will stop working straight away. This can't be undone." (A token with no name is called "token {prefix}…" here, as in the list.)
  - Buttons: "Cancel" / "Revoke token" (danger, with `IconTrash`).
- **No-JS:** there is no confirm route. In FE1 the only Dialog is on Settings, whose mutations need JS (§10.3), so the no-JS path is the `<noscript>` notice.
- **Motion:** fades in and scales from 0.98 to 1 over 180 ms `--bt-ease-out` (`motion-safe:` only). Under reduced motion it fades only. Closing is instant, as for the Drawer.
- **Component:** `Dialog` (`app/components/ui/Dialog.tsx`; `open`, `onClose`, `title`, `description`, body, `confirm: {label, icon, variant: primary|danger, onConfirm | form}`, `cancelLabel`, `pending`, `initialFocus`, `fallbackFocus`). A `danger` confirm makes it destructive, so the backdrop doesn't close it. With `form`, the confirm is a submit button for that form id.
- **Shared behaviour** (`useModalDialog`): `open` drives `showModal()`/`close()`; Escape (`cancel`, prevented and handled), the backdrop and a browser-initiated close all call `onClose`. A backdrop click must start and end on the `<dialog>` itself, so a text selection dragged out of the content doesn't close it. `html` gets `overflow-hidden` while open. The backdrop is `backdrop:bg-scrim-scrim`, which needs `::backdrop` to inherit custom properties (Chromium 122+, Firefox 120+, Safari 17.4+).

### 6.23 Toast

**Tag: FE1** (Settings feedback). Toasts carry **no actions** in FE1.

- **Region:** rendered once in `root.tsx`, **empty at SSR**: `<section aria-label="Notifications" class="fixed z-toast …">` containing two live regions:
  - `<div role="status" aria-live="polite" aria-atomic="false">` for success and info
  - `<div role="alert" aria-live="assertive">` for errors that need immediate attention
- **Placement:**
  - **Below sm: at the top**, under the header (`top: calc(var(--bt-header-h) + 8px)`, width `calc(100vw - 32px)`). At the bottom they would cover the bottom app bar and the controls near the thumb, often the very button that triggered them (WCAG 2.4.11). While toasts are shown there, the stack's height is set on `html` as `--bt-toast-stack-h`, which `scroll-padding-top` adds, so a control that gets focus scrolls clear of a toast (danger toasts stay until dismissed) as well as of the header.
  - **At ≥sm: bottom right** (`right: 24px; width: 24rem`), clear of the main column's controls: `bottom: 24px` from md, and from sm to md (where the bottom app bar still shows) 16 px above the bar (`bottom-above-app-bar`).
  - At most 3 toasts, with the newest nearest the edge.
- **Toast:** `bg-surface-raised border border-border rounded-lg shadow-2 p-4 flex gap-3`, with a status icon (`{s}-icon`), message (body-sm `text-fg`) and a close button (36 px, "Dismiss notification").
  - A 3 px left bar in `{s}-icon` means the state is not shown by icon colour alone. The icon shape differs too.
- **No actions in FE1.** An action ("Undo", "View") on an auto-dismissing toast can't be reached in time by keyboard and screen-reader users (WCAG 2.2.1), and it would be the only copy of that action. If a later milestone needs one, a toast with an action must **never** auto-dismiss.
- **Timing:**
  - Success and info auto-dismiss after **6 s**.
  - Errors **never** auto-dismiss.
  - The timer **pauses** while the pointer is over the region or focus is inside it, and resumes with the full remaining time on leave.
  - Focus never moves to a toast. There is no keyboard shortcut. The region is a landmark, reachable by landmark navigation.
- **Rules:** a toast never carries the _only_ copy of important information. A save also updates the page (the value shown, or an inline Alert). FE1 has no server-side flash messages: toasts are raised client-side from the results of the settings fetchers and the theme save.
- **Motion:** enters with `translateY(8px)` → 0 plus a fade over 180 ms (`motion-safe:`), and exits as a fade over 120 ms. Under reduced motion it fades only.
- **Components** (`app/components/ui/Toast.tsx`): `ToastProvider`, rendered once in `root.tsx` around the `Outlet`, holds the toasts and renders the region after the page; pages call `useToast()({ tone, message })`, with tone `success`, `info` or `danger`.
  - The polite and assertive lists are separate live regions, so "newest nearest the edge" holds within each list, and the error list is the one nearest the edge (`flex-col-reverse` below sm, `flex-col` from sm, on the region and on both lists).
  - When a fourth toast arrives, the oldest success or info toast goes first; an error is dropped only when all three are errors.
  - The region is `pointer-events-none` and each toast `pointer-events-auto`, so the empty region never blocks clicks. Its icons and the edge bar use `{s}-icon` on `surface-raised` (rows in §2.7).

### 6.24 ThemeToggle

**Tag: FE1.** The component is `app/components/ThemeToggle.tsx`.

- **Anatomy:** a visible label **"Theme"**, then a segmented control of three toggle buttons, `[▣ System] [☀ Light] [☾ Dark]`, using the icons `IconDeviceDesktop`, `IconSun` and `IconMoon`.
- **Markup:**
  ```html
  <form method="post" action="/resources/theme">
    <input type="hidden" name="returnTo" value="{current path+search}" />
    <div role="group" aria-labelledby="{labelId}">
      <span id="{labelId}">Theme</span>
      <button type="submit" name="theme" value="system" aria-pressed="true">
        …System
      </button>
      <button type="submit" name="theme" value="light" aria-pressed="false">
        …Light
      </button>
      <button type="submit" name="theme" value="dark" aria-pressed="false">
        …Dark
      </button>
    </div>
  </form>
  ```
  Three `aria-pressed` buttons announce as three toggles; the visible group label "Theme" ties them together. That is acceptable for a form that must work without JS.
- **Server** (`app/routes/resources.theme.tsx`, POST only; GET gets 405):
  - It checks same-origin (`assertSameOrigin`) and validates `theme` with zod as `system | light | dark` (anything else: 400).
  - It sets the cookie `theme=<light|dark>; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`. **System deletes the cookie** (`Max-Age=0`): no cookie means "follow the device".
  - With a `returnTo` field (the no-JS form), it redirects 303 to `safeReturnTo(returnTo)`. Without one (the JS save), it answers 200 JSON (`{ok: true, data: {theme}}`), so nothing navigates.
- **SSR:** the root loader reads the cookie. `<html>` gets `data-theme="light|dark"` only for an explicit choice, and `<meta name="color-scheme" content="light|dark">`, or `"light dark"` for System. The theme-color meta follows the same choice: one tag for an explicit theme, or two tags with `media="(prefers-color-scheme: …)"` for System. The stylesheet is a render-blocking `<link rel="stylesheet">` in `<head>`, and there is no theme script, so the first paint is already right and nothing flashes.
- **JS enhancement:** the form's submit is intercepted and the choice saved with a plain `fetch` (no `returnTo`; `sendForm` in `app/client/send-form.ts`), not a React Router fetcher: the toggle lives in the root's shell, and React Router throws a fetcher's failed request (a 503 the app didn't make, no network) to the owning route's boundary, which for the root would replace the whole site. The choice is applied **optimistically**: the pressed state and `<html data-theme>` (both read from `ThemeChoiceContext`, which the root `Layout` provides) update immediately, before the response; the root loader doesn't run again. On any failure, including a response the app didn't make and no network, it reverts and shows an inline error under the control (role `alert`): "Couldn't save your theme. Try again." With no network, the offline toast (§7.3) appears too. The inline message keeps the error next to the control that caused it.
- **Visual:**
  - The label is `caption font-medium text-fg-muted`.
  - The track is `bg-surface-sunken rounded-full p-0.5 border border-border`.
  - Header buttons are 36 × 32 px with icon 18. At md they are icon-only with `sr-only` names. At ≥lg they show their text too. There is **no tooltip**, so WCAG 1.4.13 doesn't apply.
  - Drawer buttons are 44 px tall, flexible width, and show visible text labels.
  - Pressed: `bg-surface-raised text-fg shadow-1 border border-border-strong`. Unpressed: `text-fg-muted` with a transparent border, hover `text-fg`. Focus-visible: the ring.
- **One toggle per page.** It lives in the header at ≥md and in the drawer below md (the drawer's is `md:hidden`, since the md drawer opens with the header still on screen). Settings has **no** Appearance section, so two toggles never appear together.
- **Keyboard:** Tab moves between the three (they are plain buttons, which suits a submit form). Space and Enter activate.

### 6.25 AccountMenu

**Tag: FE1.** "My contributions" is **FE2+**.

- **Signed out:** a "Log in" control linking to `/auth/login?returnTo={current path}`: the bottom-bar cell below md (§5.2), a secondary `sm` button at md+.
- **Signed in:** a **disclosure navigation**, not an ARIA `menu`.
  - **Trigger:** `<button aria-expanded aria-controls={panelId}>`, showing the avatar (initials on `bg-accent-subtle text-accent-text`, Fraunces 600, 32 px circle with a 1 px `border-border-strong` edge, so the disc stays visible on the light canvas and the bar's sunken cell), plus `IconChevronDown` 14 at md+. The accessible name is "Account: {display name}".
  - **Panel:** `w-64 bg-surface-raised border border-border rounded-lg shadow-2 p-2`. At md+ it is right-aligned under the header. Below md it opens **upwards**, above the bottom bar, right-aligned to the Account cell. Its contents:
    - a header showing the display name (body 600) and the role (caption fg-muted: "Contributor" / "Moderator")
    - links: "Settings" (`/settings`) and, in FE2+, "My contributions"
    - a separator
    - "Log out", a `<Form method="post" action="/auth/logout">` button styled as a menu row
  - Rows are `h-10 px-3 rounded-md body-sm` (44 px below lg), with hover `bg-surface-sunken`.
- **Profile failed to load** (the root loader's `/v1/me` call failed): the trigger reads "Account" with `IconUserQuestion` in the disc instead of initials, and the panel shows a `warning` inline message, "We couldn't load your profile. [Try again]", above the Settings and Log out rows. Pages still render.
- **Blocked:** the disc shows `IconUserOff`, so the two states without a name look different; the panel shows the danger message and "Log out" only.
- **Keyboard:** Enter or Space toggles. Escape closes and returns focus to the trigger. Tab moves through the links. Focus leaving the panel, or clicking outside, closes it.
- **No-JS:** `<details><summary>` with the same panel.
- **Built as (FE1):** `app/components/AccountMenu.tsx` uses `<details>` with JS too, rather than swapping to a `<button aria-expanded>` after hydration: the summary is a native disclosure (its expanded state is exposed by the browser), so there is one markup and no hydration swap. JS adds the closing rules through `useDismiss` (Escape returns focus to the summary; a press or focus outside, or a navigation, closes it). The trigger's accessible name comes from `sr-only` text ("Account: {name}"; the bar cell's visible "Account" starts it), not `aria-label`. The root loader's account states are `signed-out`, `signed-in`, `profile-unavailable` and `blocked` (`app/constants/account.ts`); a blocked account's panel shows the danger message and "Log out" only.

### 6.26 SearchBox

**Tag: FE2** (built; FE1 searched the original wiki).

- **Markup:** `<Form role="search" method="get" action="/search">` (target and parameter name from `SEARCH` in `app/constants/navigation.ts`), with `<label for={inputId} class="sr-only">Search the catalogue</label>` and `<input type="search" id={inputId} name="q" autocomplete="off" enterkeyhint="search">`, prefilled by `defaultValue` on the search page. The placeholder is "Search pieces and bards…" at `lg` size, and "Search…" in the header field while it is narrow (md), so it is never cut mid-word; from the lg breakpoint, where the header field is wide, the long text is drawn over the field instead (an `aria-hidden` hint shown while the field is empty).
- **Visual:** Input styling at `h-10` (40 px, header md+) or `h-11` (drawer, search sheet, home hero and the search page), `rounded-full`, with a leading `IconSearch` 18 `fg-subtle`. The submit button is a trailing ghost icon button (`IconSearch`, named "Search", no external mark), always present so the form works without Enter: 44 × 44 px at `lg` size (the input is `pr-12`), and 32 px in the 40 px header field with its hit area padded to 44 px below lg (`before:-inset-1.5`, as Button `sm`). Its hover wash is `bg-fg-10`, a decorative see-through tint (§2.6), because a `surface-sunken` wash would vanish on the dark field, which is itself `surface-sunken`.
- **Submit:** with JS it goes straight to the canonical `/search?q=` (`useCanonicalSubmit` with `searchQuery`: the search trimmed, one request); without JS the browser's own GET, which the page canonicalises with a 301 only when `q` needs it.
- **Bottom-bar Search cell (<md):** see §5.2. It opens the search sheet above the bar; a search (any navigation) closes it.
- **States:** focus shows the ring. There are no suggestions and no loading state; the search page (§10.11) has the results and their empty states.
- **No keyboard shortcut.** A single-key `/` shortcut would break WCAG 2.1.4 (it fires for speech-input users too), and none is provided.

### 6.27 Table of contents (help pages)

**Tag: FE1** (inline). The sticky right rail, the current-section highlight and the heading "§" anchors are **FE2+**.

- Shown when a page has **≥4 h2s**. It is `<nav aria-labelledby={titleId}>`, with the title "Contents" in `label-caps`. Items are an `<ol>` of h2s and h3s, each with its number (e.g. "2.1") in `text-fg-subtle tabular-nums`, right-aligned in a `min-w-6` column so "10" lines up with "9".
- The box is `flow-root` (its own block formatting context): beside the floated infobox the whole sunken box narrows, instead of its background running under the float while only its lines wrap. Each item link is `inline-flex min-h-6 items-center` (WCAG 2.5.8).
- **<xl, and in FE1 at every width:** inline after the intro paragraph, as `<details open>` on md+ and `<details>` (closed) on mobile, with `bg-surface-sunken rounded-lg p-4`.
- **≥xl with no infobox (FE2+):** sticky in the right rail (`top: calc(var(--bt-header-h) + 24px)`, width 14rem). The current section is highlighted with an IntersectionObserver: `aria-current="true"`, `text-accent-text font-semibold` and an inset left bar. With no JS, there is no highlight.
- **Built as (FE1):** `TableOfContents({ entries: [{ id, label, children? }] })`. It server-renders `<details open>` (so it is open without JS) and folds itself after hydration below md. That happens once, on mount: resizing or rotating later leaves it as the reader has it (unit-tested; e2e checks it folded at 360 on load). `WikiPage` shows it after `intro` when `contents` has four or more entries.
- Headings get `id`s (and `scroll-margin-top`, §3.3). FE2+ adds a hover "§" anchor link, 24 × 24 px, `aria-label="Link to this section"`.

### 6.28 FacetForm (piece filters)

**Tag: FE2.**

- **What it is:** `FacetForm` (`app/components/facets/FacetForm.tsx`), one `<Form method="get" action="/pieces">`: a `FacetGroup` fieldset per facet (Kind, the term facets mood … other, Conservation status), the "Page state" radios (All pages / Stubs only / Hide stubs) and "Apply filters" (secondary `sm`, never hidden). `q` and `letter` ride along as hidden inputs when set; the page doesn't (new filters start at page 1). The groups come from `facetGroups` (`app/catalogue/facet-groups.ts`): the API's slug counts joined with the term tree (`term-index.ts`).
- **An option** is a Checkbox row named "Warlike, 31 pieces" and showing "Warlike (31)" (the visible text, count included, is `aria-hidden`; the count is `text-fg-muted` and `tabular-nums`). The name is one `sr-only` run, "Warlike, 31 pieces": a comma in a second `sr-only` span would get a space before it (an absolutely positioned span counts as a block in the accessible name), so the label is written out whole. The count is the API's disjunctive one, never "+N". A term is indented one step (`pl-6`, then `pl-12`, `pl-16`) per level under its parent. An option nothing would match is disabled and greyed (`text-fg-subtle`, "(0)") unless it is ticked. Two options of a facet with one display name show their full names. Past 8 options a group shows the first 8 and every ticked one, then a native `<details>` "Show all {n}" (`summary-plain`, `text-link`, 44 px below lg) with the rest: closed, its boxes are still submitted.
- **The order** ("Sort by", only with `q`, and only when the search found something: with zero results there is nothing to order) sits above the results but belongs to the form (`form={id}`); "Best match", the default, sends an empty `sort`, as "All pages" sends an empty `stub`. The loader takes those empty values as no value (`blankable`), so the form's own GET is answered 200. With JS the select applies on change; without JS a "Sort" submit beside it sends the form.
- **Where it is:** `<section id="filters">` with its h2 "Filters", after the results and Pagination in the DOM at every width (WCAG 1.3.2, 2.4.3). From **xl** `grid-cols-browse` lifts it into a 16 rem left column, and a "Skip to filters" link (visible on focus) follows the page heading. Below xl a secondary "Filters ({n} selected)" link (`IconFilter`, 44 px) after the chips jumps to it.
- **With JS** it never submits itself: Apply goes straight to the canonical URL (`useCanonicalSubmit`, `app/components/catalogue/canonical-form.tsx`). From xl every change applies at once (`autoSubmit`, from `useMediaQuery("(min-width: 1280px)")`), the old results staying, `aria-busy`, until the new ones are in. The form is keyed on the canonical query, so a chip, a letter or Back rebuilds it from the URL; the box focused last is focused again after the rebuild.
- **Below xl with JS: the drawer** (`FacetDrawer`, `app/components/facets/FacetDrawer.tsx`, FE2 C2.3). After hydration the in-flow `#filters` section isn't rendered (it follows the results, so nothing above it moves) and the Filters control becomes a `<button aria-haspopup="dialog" aria-controls>`. It opens the Drawer (§6.21) titled "Filter pieces", `closeLabel` "Close filters", `closeFrom="xl"`: a bottom sheet below md, the left edge from md. Its body is the same FacetForm without Apply and without auto-submit; the footer has **"Show results"** (primary, full width, the form's submit through `form={id}`) and **"Clear all"** (a secondary full-width `ButtonLink`, `nofollow`, to the list without its term, kind, status and stub filters, keeping `q` and the letter), above the Drawer's own Close. The footer is the Drawer's (§6.21): outside the scrolling body, so it stays in view however far the facets scroll and nothing scrolls under it, separated by `border-t border-border`, with all three buttons full width at 44 px (`md`, `min-h-11`). There is no live result count. Show results goes to the canonical URL; the navigation closes the drawer and focus returns to Filters. Escape, Close or the backdrop discard the unapplied ticks: the form is mounted only while the drawer is open, from the URL's state. Only one FacetForm is ever mounted (the column's or the drawer's), so its ids are unique; the order select belongs to whichever it is. A failure on Show results (an outage) is the route's error boundary, which replaces the page drawer and all.
- **Failures:** without the terms the term facets are replaced by the SectionError "We couldn’t load the categories" (with Try again) after Kind; Kind, Conservation status and Page state still work, and the chips name categories by slug.

### 6.29 LetterBar (A–Z index)

**Tag: FE2.**

- `<nav aria-label="{List} by letter">` ("Pieces by letter") holding a wrapping `ul role="list"` of 28 cells: **All**, then `0` and A to Z, the API's `Letter` order. `0` reads "0–9" and is named "0–9 and others" (the index's catch-all for digits, punctuation and other scripts; `letterLabel` in `app/constants/vocabulary.ts`).
- A letter with entries (the list's `letters` counts) is a link to the list under it, `href(state, {letter})`; All is `href(state, {letter: undefined})`. Both keep the rest of the state and reset the page. The links stay followable (no `nofollow`): letter pages are indexable.
- A letter with no entries is a `<span aria-disabled="true">` in `text-fg-subtle cursor-not-allowed`, not a link, so Tab skips it. It keeps the links' `font-medium` (so a letter doesn't change width as its entries come and go) and has no fill and no hover, so it is lighter than a link, like Pagination's disabled steps (§6.20). The counts ignore only the `letter` filter, so with zero results a letter that has entries under the rest of the state is still a link, and a search that matches nothing leaves every letter as text, with All the current cell.
- The current cell (the letter, or All with none) is `aria-current="page"` on `bg-accent text-accent-fg font-semibold`, a `span`, never focused, like Pagination's current page (no ring on accent, §2.6).
- **Cells:** `min-h-9 min-w-9` (36 px) below lg, `min-h-8 min-w-8` from lg, `rounded-md body-sm`, `gap-1`. The states, the same in both themes (every pair in §2.7):
  - **idle link:** `text-link font-medium`, no fill;
  - **hover:** `bg-surface-sunken text-link-hover`;
  - **focus:** the shared ring, inset (`focus-visible:-outline-offset-2`), because the row is dense (§6.1): it sits on the sheet behind the link or its hover wash (`focus` on `surface` / `surface-sunken`, both in §2.7) and never overlaps a neighbour. Pagination, an equally dense row, still has the outset ring (backlog);
  - **empty (disabled):** `text-fg-subtle font-medium cursor-not-allowed`, no fill, hover or ring;
  - **current:** `bg-accent text-accent-fg font-semibold`, never focused (no ring on accent).
    They are not primary controls (WCAG 2.5.8 is met at 24 px).
- **Built as:** `LetterBar({label, letters, current, href})` in `app/components/catalogue/`.

### 6.30 Entity page parts (track B: C4, C5)

**Tag: FE2.** The parts of a piece's and a bard's page, consumed by their routes (no styleguide specimens: the page checkpoints `piece/*`, `bard/*` cover them in both themes, plan §8 budget).

- **EntityPage** (`app/components/EntityPage.tsx`): WikiPage (§10.2) with the entity's two views on the title rule, Read (`path`) and History (`{path}/history`, C8.1), as links in the "Page views" nav (§6.9 a′); `history={false}` leaves the single Read label (a person with no page). WikiPage gains the optional `subtitle` (the meta line under the h1, `body-sm text-fg-muted`, §5.4 item 3), `views` and `banners` (PageBanner, in a `grid gap-3` under the title rule). There is no Edit view until FE3.
- **Sections** (`PageSection` / `pageSection` in `app/components/catalogue/PageSection.tsx`): each body section is a `<section aria-labelledby>` with a prose h2 (the h2 rule), and an entry of the page's contents (`TableOfContents`, from four h2s).
- **Disclosure** (`app/components/catalogue/Disclosure.tsx`): a native `<details>`, closed; the summary is `summary-plain`, `min-h-6`, `body-sm font-medium text-link` with a 16 px chevron that turns on open. `openWhen` (a media query) opens it with JS where it matches (the bards' filters at xl). Used for the status history, the restricted links and the bards' filters.
- **Credits** (`app/components/piece/Credits.tsx`): an infobox row per credit; the label is the role ("Words", "Tune", "Author", "Choreography", "Music", "Arrangement", "Translation") with the part in brackets ("Tune (tune)"); the value is the person's link or the attribution ("Traditional", "Unknown", "Anonymous", "Various"), the certainty qualifier in `text-fg-muted` ("(probably)", "(possibly)", and "(disputed)" after a 14 px `IconAlertTriangle`: the word carries it, never the icon alone) and the note as a caption. No credits is the empty value; never "unknown author".
- **Origin** (`OriginRow`): the `origin`-facet terms as `sm` chips, the main source first with "(main source)", the others prefixed with their part ("Tune:").
- **ConservationRow**: the `md` badge as a link (named "Conservation status: …", §6.13), and a Disclosure "Status history ({n})" with each change oldest first: `<time>` caption, the `sm` badge, the reason, and "Source ↗" (a reader's URL, `rel="nofollow ugc noopener"`).
- **LinkGroups / LinkRow / Liveness** (`app/components/links/`): links grouped by role, an h3 each in `LinkRole` order (or `first` before the rest: a person's external profiles), a link under every role it has. A row (`ul.not-prose`, `border-b` rows, `wrap-anywhere`): the title or host as an external link (`nofollow ugc noopener`), a caption "{platform} · {place type} · Checked {date}" (the date only for `ok`), "In {collection} ({locator})" with the collection as an internal `plain` link, the description, and the liveness note: `dead` is `body-sm text-warning-fg` with a 16 px `IconAlertTriangle` (`text-warning-icon`; both pairs on `surface` are in §2.7) "This link may be broken" and "Archived copy ↗" when there is one and archives are allowed; `blocked` is the caption "This site wouldn’t let us check the link"; `ok` and `unknown` have no note.
- **Performances** (`app/components/piece/Performances.tsx`): a prose table from md (Year, Performers, Event, Recording with "As described: ‘…’" in a `<q>`, Uploaded by), a bordered card per performance below md; newest year first, "Year unknown" last.
- **The restricted disclosure** (`RestrictedLinks`, plan §4.0): under the h2 "Where it has been recorded", one closed Disclosure "Show links (the creator asks that this isn’t shared further)" whose body starts "The creator has asked that this work isn’t recorded or shared. These links are listed for reference only; please don’t repost them.", then the link groups without archived copies, then "Recorded performances". No "Add" or performance prompts. Off the piece's page a restricted piece's recording is the caption "Link not shown: see the piece page", with no anchor (`linkExposure`, `app/catalogue/restricted.ts`).
- **LicensingCard** (`app/components/catalogue/LicensingCard.tsx`): the static Card (§6.11) with an h2 "Licensing" (`id="licensing"`, Card's new `headingId`), in a `not-prose` wrapper: "Licensing known" (`IconCircleCheck`) or "We don’t know how this piece is licensed yet" / "…how this person licenses their work yet" (`IconHelpCircle`), both icons `text-fg-muted`; a piece's licence by its family name (the 6 CC families link to `https://creativecommons.org/licenses/`, `CC_LICENCES_URL`, with the caption "The version isn’t recorded; check the source for the exact terms."); the notes (UserMarkdown); "Sources" (the `licensing_source` links, or "Sources are listed under Where it has been recorded." for a restricted piece); the etiquette caption linking to the bard preference checklist. `LicensingSummary` is the infobox row's link to it: "Known: CC BY-SA", "Known", "Unknown".
- **RelatedPieces** and person **Relations**: one h3 per relation as read from this side ("Variant of" / "Variants", "Contrafactum of" / "Contrafacta", "Setting of" / "Settings", "Same text in another form"; "Member of" / "Members", "Heir of" / "Heirs", "Also recorded as"), PieceListItem rows or person links with their kind.
- **Works** (`app/components/person/Works.tsx`): a prose table (Piece with its `sm` badge unless unassessed; "Credited for": the credit label and qualifier), split by role under h3s "Words (12)", "Tunes (3)" when there are two or more; "and {n} more not listed here" (caption) when the API's 200 cap cut it.
- **PersonPerformances**: a row per performance (year, the piece or "No particular piece", the event, the recording, "As described"), the same caption past 200.
- **UserMarkdown** (`app/components/UserMarkdown.tsx`): renders the loader's sanitised Markdown tree (`app/schemas/markdown.ts`) as plain elements inside `.prose-bt`; headings start at h3; links are `Link userContent` (or a mailto anchor with the same `rel`). The parser (`mdast-util-from-markdown`) runs only in loaders (`app/server/markdown.server.ts`); `check:prod-build` fails if a client chunk has micromark.
- **LicenceLine** (`app/components/catalogue/LicenceLine.tsx`): the caption at the foot of every entity Read page: "Text is available under the Creative Commons Attribution-ShareAlike 4.0 licence. This page may be adapted from the original Bardic Torch wiki; its contributors are credited in the page history." (both links `inherit`); a person with no page ends at "…the original Bardic Torch wiki.".
- **PersonListItem** (`app/components/catalogue/`): a row like PieceListItem: the name as a compact link, then the kind and "Stub" (caption).

---

## 7. States and feedback

### 7.1 Loading: skeleton vs spinner

| Situation                                                                       | Use                                                                                                                                                                                                                                                                                                                                         | Tag                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Full page navigation (SSR)                                                      | Nothing. The server renders real content.                                                                                                                                                                                                                                                                                                   | FE1                                  |
| Client navigation taking >300 ms                                                | A global **progress bar**: 3 px `bg-accent`, top of the viewport, fixed above the header, `aria-hidden` (`role="progressbar"` is **not** used). The `<main>` gets `aria-busy="true"` while the transition runs. Hidden under 300 ms to avoid flicker. Its sweep is `motion-safe:` only; under reduced motion it is a static full-width bar. | FE1                                  |
| A region whose layout is known (infobox, list, token table) loading client-side | **Skeleton** at the exact final size                                                                                                                                                                                                                                                                                                        | SG (FE1 regions are server-rendered) |
| A button action (save, revoke, create)                                          | **Button loading state** (spinner in the button), plus a form-level `role="status"` text "Saving…"                                                                                                                                                                                                                                          | FE1                                  |
| An inline async check (e.g. a name in use)                                      | 16 px Spinner inside the input, plus help text "Checking…"                                                                                                                                                                                                                                                                                  | FE2+                                 |
| Anything >10 s                                                                  | Not expected in FE1. If it happens, show a determinate message, "Still working…", after 5 s.                                                                                                                                                                                                                                                | FE2+                                 |

### 7.2 Empty

The shape is always a title, one or two sentences, and one action. See §11 for copy. Examples:

- **No API tokens (FE1):** "No tokens yet" / "Create a token to let tools like an MCP client work with Bardic Torch for you." / [Create token].
- **No search results (FE2):** see §11.3 and the search page (§10.11).
- **No categories (FE1):** the inline caption (§6.12).

### 7.3 Errors: inline vs page

- **Inline** (field-level, FE1): the field pattern (§6.4). The error summary is SG.
- **Region-level** (part of a page failed, FE1): an ErrorState inline Alert. The rest of the page stays usable. Example: the root loader's profile call fails, and the account panel shows its warning (§6.25) while every page still renders.
- **Page-level** (loader threw, 404, 500; FE1): the React Router `ErrorBoundary` renders the error page template (§10.5) _inside the app shell_, so header and nav still work. The `<title>` is "Page not found · Bardic Torch" or "Something went wrong · Bardic Torch". Focus moves to the h1 on client-side errors. The 503 "resting" variant (FE2) is §10.5's.
- **Network / offline** (fetch failure on a client action, FE1): a danger toast, "You seem to be offline. Your changes haven't been saved yet.", plus the inline error in the affected form. Form values are kept.
- **A response the app didn't make** (a platform 503, a gateway's 502 or HTML error page, FE1): the inline error in the affected form, the form's "We couldn't … Check your connection and try again." Form values are kept. A mutation never ends in an error boundary: the settings forms submit to the settings route's `clientAction`, and the theme toggle saves with `fetch`; both read every outcome as a proxy body (`sendForm`).

### 7.4 Success

- **FE1 (Settings, JS only):** after a settings form's fetcher (through the settings route's `clientAction` to the `/api/*` proxy) succeeds, the changed value is updated on the page and a success toast confirms it ("Display name saved."). After a token is created, the one-time reveal Alert appears in place (§10.3).
- **FE2+ (no-JS forms):** after a POST-redirect-GET, a success Alert at the top of the affected section.
- Focus stays where it was, or moves to the Alert if the form disappeared.
- Copy is in the past tense and specific: "Display name saved." Don't write "Success!".

### 7.5 Pending approval (banner wording pattern)

**Tag: FE3** (editing). The wording is fixed here so the Banner component can be built and shown in the styleguide (SG).

Every edit from a non-moderator waits for one of the moderators. This is a normal step and is written warmly. The banner is the `pending` variant, non-dismissible, placed directly under the tab row.

- **To the author, on the page they edited:**
  > **Your edit is waiting for approval.** You saved changes to _{Page title}_ on {d MMM yyyy}. Until a moderator reviews them, everyone else sees the last approved version. [View your version] · [Why do edits wait?]
- **To other readers, when a pending version exists:**
  > **A newer version is waiting for approval.** You're reading the last approved version. [See what changed] _(moderators only; others see no link)_
- **To moderators:**
  > **1 pending edit by {name}.** [Review it]
- **After submit (toast and success Alert):** "Thanks! Your edit has been sent for approval."

The pattern is: **what state it is in** (bold, ≤7 words), then **what it means for you**, then **one or two actions**. Never use the words "rejected", "blocked" or "error" for pending.

**Related page-level banners** (FE2, `PageBanner`, §6.14):

- **Stub** (info): "**This page is a stub.** We know this piece (or person) exists but haven't gathered much yet. [How to contribute]". Until editing exists (FE3) the action is the contributing guide; it becomes "Help complete it" with the edit form.
- **Restricted** (info variant, icon swapped for `IconLock`): "**The creator has asked that this work isn't recorded or shared.** Please respect their wishes. [Read their statement ↗]". This replaces every "help preserve" prompt.
- **Prefers no page** (info): "**{Name} has asked not to have a page here.** This stub keeps their request on record so the page isn't recreated. [Read their statement ↗]".
- "Read their statement ↗" shows only when the API has a source URL for the statement; without one the banner has no action.

---

## 8. Motion

### 8.1 Tokens (CSS vars from `tokens.ts`, also in Tailwind `transitionDuration` / `transitionTimingFunction`)

| Token                | Tailwind           | Value                        | Use                                                |
| -------------------- | ------------------ | ---------------------------- | -------------------------------------------------- |
| `--bt-dur-instant`   | `duration-instant` | 80 ms                        | Colour and background changes on hover             |
| `--bt-dur-fast`      | `duration-fast`    | 120 ms                       | Focus/press feedback, link arrow nudge, toast exit |
| `--bt-dur-base`      | `duration-base`    | 180 ms                       | Dialog, menu and toast enter, scrim fade           |
| `--bt-dur-slow`      | `duration-slow`    | 240 ms                       | Drawer slide, disclosure height                    |
| `--bt-dur-flicker`   | `duration-flicker` | 600 ms                       | Logo flame (one-shot)                              |
| `--bt-ease-standard` | `ease-standard`    | `cubic-bezier(0.2, 0, 0, 1)` | Default                                            |
| `--bt-ease-out`      | `ease-out`         | `cubic-bezier(0, 0, 0.2, 1)` | Entering                                           |
| `--bt-ease-in`       | `ease-in`          | `cubic-bezier(0.4, 0, 1, 1)` | Leaving                                            |

These replace Tailwind's default durations and easings. The keyframe animations are `animate-spin` (spinner), `animate-pulse-soft` (opacity 1 → 0.4, the reduced-motion spinner), `animate-shimmer` (skeleton), `animate-progress` (progress bar), `animate-flicker` (logo), `animate-dialog-in` (fade + scale 0.98 → 1), `animate-toast-in` (fade + 8 px rise), `animate-sheet-in` / `animate-drawer-in` (slide from the bottom / left) and `animate-fade-in` (opacity only, 120 ms: the reduced-motion entrance for all of them, and the scrim).

### 8.2 What animates

- **Animated:** colour and background on hover and focus (80 ms); a 1 px press translate; drawer, dialog, menu and toast enter/exit; the skeleton shimmer; the spinner; the progress bar; the logo flicker on hover (once); the external-arrow nudge.
- **Never animated:** layout properties (width, height, top) on page load; theme switching (colours change instantly, with no cross-fade, to avoid flashing large areas); scroll-jacking. `scroll-behavior: smooth` is set only inside `@media (prefers-reduced-motion: no-preference)`.
- No animation runs longer than 600 ms. Nothing loops except the spinner, the shimmer and the progress bar, which only run while loading.

### 8.3 Reduced motion

`@media (prefers-reduced-motion: reduce)`:

- All `transform`-based movement (slides, scale, translate, nudge, flicker) is removed. Transitions become opacity only, at ≤120 ms.
- The skeleton shimmer is off (static blocks). The spinner switches to the opacity pulse. The progress bar becomes a static full-width bar that appears and disappears.
- `scroll-behavior: auto`.

**The mechanism (one, chosen in FE1): the `motion-safe:` variant.** Every class that moves something carries the `motion-safe:` prefix: `motion-safe:transition`, `motion-safe:transition-all`, `motion-safe:transition-transform` and `motion-safe:animate-*`. The only exceptions are `motion-reduce:animate-pulse-soft` and `motion-reduce:animate-fade-in`, which are opacity-only. Colour-only transitions (`transition-colors`, `transition-opacity`) need no prefix. Hand-written CSS puts any `animation`, transform `transition` or `scroll-behavior: smooth` inside `@media (prefers-reduced-motion: no-preference)`. There is no global "kill all animation" rule, because it would also kill the allowed fades.

ESLint has no rule for this, so `test/motion.test.ts` enforces it. It scans the source (`app/` classes and CSS) and fails on any of those classes without the variant, and on any CSS animation or transform transition outside the no-preference block.

---

## 9. Dark mode: approach and testing

### 9.1 Approach (summary of §2.2)

Dark mode is a separately tuned palette with the same token names:

- Warm charcoal canvas `#16120E`, never `#000`.
- Surfaces get lighter as they come forward, and wells get darker.
- Hues are desaturated and lightened, and text is vellum `#E4D9C6`.
- The amber accent becomes a lamp: a light fill carrying dark text.
- Shadows are replaced by borders and surface steps.
- Images and illustrations: the logo is token-driven. Future raster images get `filter: none` (never invert photos), with a 1 px `border` so they don't float.

### 9.2 Rules for authors

1. Use tokens only. `dark:` is never used (§2.1). If a component seems to need a theme difference, add a token instead.
2. Every new text-on-background pair goes in the §2.7 table, which `npm run check:contrast` reads, and must pass in both themes.
3. Don't use opacity to make text "muted". Use `fg-muted` or `fg-subtle`.
4. Check the focus ring on every surface the component can sit on.
5. Component tests render each state in both themes by setting `data-theme` on `document.documentElement`.

### 9.3 Testing (CI, part of FE1's harness)

- **Screenshots:** every e2e journey checkpoint (`checkpoint(page, name)` in `e2e/support/journey.ts`) saves `{light, dark} × {360×800, 768×1024, 1280×800}` full-page PNGs. They cover each page template and `/styleguide` (every component, every state).
  - The checkpoint sets the theme the way a user would, with the `theme` cookie, and keeps the emulated `prefers-color-scheme` consistent with it.
  - The `@media` path (no cookie) is tested separately in `e2e/prod/theme.spec.ts`: with no cookie, the page follows the emulated scheme; and a `light` cookie under an emulated dark OS renders light. These compare computed token values, not screenshots.
  - **Every component MUST be screenshot-reviewed in both themes** by the UX/accessibility reviewer before the milestone lands.
- **axe:** `@axe-core/playwright` runs at every checkpoint in both themes at **360 and 1280** px, with zero violations for the WCAG 2.0–2.2 A/AA tags (including `color-contrast`).
- **Contrast:** `npm run check:contrast` checks every pair in §2.7 and the accent/danger hue gap. `npm run check:tokens` checks the generated files are fresh.
- **No-flash test:** the raw HTML for a `theme=dark` request (`request.get`, no browser) already contains `<html … data-theme="dark">` and `<meta name="color-scheme" content="dark">`, and the stylesheet is a render-blocking `<link rel="stylesheet">` in `<head>`. There is no theme script to wait for.
- **No-JS run** (`javaScriptEnabled: false`): the theme toggle POST works, and so does the drawer's anchor fallback.
- **Forced colours:** one run with `forcedColors: 'active'` on the styleguide, which must stay usable (focus, pressed and current markers visible; checkboxes visible).
- **Zoom/reflow:** 320 CSS px (1280 at 400 %) with no horizontal scroll except tables and code (WCAG 1.4.10), on **every journey**. The text-spacing override (WCAG 1.4.12) must not clip, checked on the styleguide.

---

## 10. Page templates

Every page uses the app shell (header, bottom bar or sidebar, drawer, sheet, footer with HelpLinks), and has a unique `<title>` of the form "{Page} · Bardic Torch" plus a `meta description`.

Content pages write their meta one way, with `pageMeta(args, {title, description, path, robots?, type?, preview?})` (`app/catalogue/seo.ts`) from the route's `meta`: the title ("{title} · Bardic Torch"; the site's name alone on Home), the description cut at a word to 160 characters with "…", an absolute `<link rel="canonical">` built from `path` and the root loader's `siteOrigin` (the request URL's origin), `og:title`, `og:description` (`preview` when given, e.g. a help page's `summary`), `og:url`, `og:type` (`website` by default; `profile` for bard pages), `og:site_name` "Bardic Torch", `og:locale` `en_GB`, `twitter:card` "summary", and `robots` only when asked. Home, the help pages and the catalogue pages use it (a list page's `path` is the pathname plus its canonical query, `/pieces?letter=T`, so an order-only variant names the ordered form); the error pages, Settings and the styleguide keep their fixed title and `noindex`.

### 10.1 Home (`/`)

**Tag: FE2** (FE1's placeholder home sent browsing to the original wiki). There are no tabs and no Read label. The sheet has no title rule: the hero replaces the page head.

```
┌ sheet (bg-surface) ──────────────────────────────────────────────┐
│  [hero panel: radial glow accent-glow → transparent, over        │
│   surface only; rounded-xl]                                      │
│   🔥 (48px mark)                                                  │
│   Find the songs, stories and poems of the bardic community.     │ display (h1)
│   Bardic Torch is a community-kept index of SCA bardic pieces    │ body-lg fg-muted, ≤60ch
│   and the bards who made them — so they can be found, sung and   │
│   passed on.                                                     │
│   [Browse pieces] (primary lg)      [How to contribute]          │
│                                      (secondary lg)              │
│   [🔍 Search the catalogue…               ] (SearchBox h-11)      │
│   142 pieces and 61 people and groups so far      (body-sm)      │
├──────────────────────────────────────────────────────────────────┤
│  Why Bardic Torch                                    (h2 + rule)  │
│  ┌ An index, not ┐ ┌ Links only ───┐ ┌ Keep works ───┐            │ 3 static Cards in a
│  │ an archive    │ │ We never host │ │ alive         │            │ ul role=list (1 col <md,
│  │ We make       │ │ lyrics, audio │ │ Some works …  │            │ 2+1 md, 3 col ≥lg)
│  │ existing …    │ │ or video …    │ │ [statuses →]  │            │
│  └───────────────┘ └───────────────┘ └───────────────┘            │
│  Start exploring                                     (h2)        │
│  TagList md: (Song (120))(Poem (6)) …(Mood: Joyful)(Topic: War)  │
│  All categories · Collections · Events and venues                │
│  For bards                                           (h2)        │
│  Short paragraph + [FAQ for bards] [Bard preference checklist]    │
│  ┌ info Alert (not dismissible) ──────────────────────────────┐   │
│  │ ⓘ Bardic Torch is community-maintained and isn't affiliated │  │
│  │   with the SCA or any other organisation.                   │  │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

- **Hero copy**, adapted from the wiki Main Page:
  - Heading (h1): "Find the songs, stories and poems of the bardic community."
  - Lead: "Bardic Torch helps bards find where a piece's words, music, history, context and etiquette live, and helps audiences find that song they loved around the campfire but forgot the title of. We gather the bardic community's scattered songbooks, playlists and album pages into one index, so works can be found, sung and passed on." (The judged home copy, except its opening: "find music, lyrics, history…" read as a lyrics site to a skimmer, against "links only, never lyrics"; "find where … live" says the same thing as an index. Longer than the first sketch, still ≤ 60ch per line.)
- **Calls to action.** **"Browse pieces"** (primary `lg`, to `/pieces`) and **"How to contribute"** (secondary `lg`, to `/help/contributing`). The search under them searches the catalogue (`/search?q=`, §6.26). Under the search, a `body-sm fg-muted` line says how big the catalogue is: "{n} pieces and {m} people and groups so far" (`persons` include groups, historical figures and stubs, so "bards" would overstate). If either count can't be read the line is left out and a SectionError appears under "Start exploring".
- **Why cards** (`static` Card variant, §6.11), from the judged home copy. The "links only" message is the end of card 1, creator's wishes included:
  1. **An index, not an archive**: "Bardic works are spread across many songbooks, playlists and album pages. We don't replace them. We link to them and make them findable by mood, topic, culture, origin and more. We never host lyrics, recordings or video: every piece points to where it already lives, and to its creator's wishes about sharing."
  2. **Every version, everywhere**: "We link to each version of the words and each performance, wherever it lives online or in print. Some works exist in only one or two places. When you find an endangered piece, add a link or host a copy, and help pass the torch." It ends with a text link, "How conservation statuses work", to `/help/conservation-status`. Under the text, three static `sm` ConservationBadges (Endangered, Critically endangered, Low risk), each followed by a plain link ("Browse endangered pieces", …) to `/pieces?status=…`. The badge itself is not the link: its link variant goes to the help page (§6.13).
  3. **Anyone can contribute**: "You don't have to be a bard, and no contribution is too small. Editing is not open yet: it arrives in a later release. Until then, send us the link to where a work lives, and once editing opens a moderator will review every edit before it goes live. That way the index can keep growing beyond what any one person could maintain." It ends with a text link, "How to contribute".
- **For bards:** the paragraph from the home copy, then two secondary buttons, "FAQ for bards" and "Bard preference checklist", then the non-affiliation info Alert.
- **Built as (FE2):** `app/routes/_index.tsx`, with a loader that reads `listPieces?limit=1`, `listPersons?limit=1` and `listTerms` anonymously. The hero panel is `rounded-xl bg-hero` (the radial glow, Appendix A). Each section is a `<section>` labelled by its h2 (with the rule). A failed read never fails the page: its region says so with a SectionError and "Try again".
- **Start exploring** comes **after** the Why cards. Its chips are the piece kinds with their counts (`/pieces?kind=song`, from the facet counts) and the three most-used moods and topics (`/categories/{slug}`), all internal. Then plain links to "All categories", "Collections" and "Events and venues".
- **Hero visual:** a soft radial gradient from the top-left, `accent-glow` at 18 % (light) or 8 % (dark) fading to transparent, composited **over `surface` only** (never over `accent-subtle`). Its strongest point is the `hero-glow` token, and every pair on the hero is checked against it in §2.7. The 48 px mark sits above the heading. There is no image.
- **Name note** (caption, fg-subtle, bottom of the sheet): "The name has two meanings: a torch to search by, and passing the torch so works are kept for the next generation."
- **Mobile:** the hero buttons stack full width (`lg`), primary first, then the search.

### 10.2 Help article (`/help/:slug`)

**Tag: FE1.**

- **Page head:**
  - breadcrumbs "Help › {title}"
  - h1
  - no meta line (the breadcrumb, sidebar and chips already say "Help")
  - the tab row with the **non-interactive "Read" label** (§6.9 a′)
  - the right of the tab row: "Adapted from the original wiki ↗" (caption, a link to the source page). This is the page's only meta.
- **Optional infobox "At a glance":** a 3–6 row `dl` summarising the page. For example, Conservation status lists the five statuses, each a link to its own row of the status table (or to its section). The Bard preference checklist shows "What it is / Who it's for / Time needed".
- **TOC** when there are ≥4 h2s (§6.27).
- Prose in `.prose-bt`.
- **Template (FE1):** `WikiPage` (`app/components/WikiPage.tsx`): `title`, `breadcrumbs?` (Breadcrumbs props), `meta?` (the tab row's right end), `infobox?`, `intro?`, `contents?` (TOC entries), `categories?` (TagList tags; the chip row is `<nav>` labelled by its "Categories" h2), `licence?` (the footer meta line) and the prose as children. The Read label's `to` is the current path.
- Category chips at the bottom (e.g. "Help", "Conservation"): internal links, to `/help` or to the category's page (`/categories?facet=conservation`).
- **Footer meta line** (caption fg-subtle): "This page is available under CC BY-SA 4.0. Adapted from 'Conservation Status' on the original Bardic Torch wiki by its contributors."
- **Content pages in FE1:** `contributing`, `faq-for-bards`, `bard-preference-checklist`, `conservation-status`, `licence`, plus an index at `/help`. The index is a `ul role="list"` of `link` Cards.
- Help pages are **Markdown** (`.md`, compiled by `@mdx-js/rollup` with `format: "md"`), with `:::note`, `:::warning` and `:::infobox` directives that map to Alert and Infobox. They are reviewed for tone (§11) and adapted rather than copied verbatim. Remove the wiki's mobile warning and "make an account on Miraheze" instructions.
- **Built as (FE1):** the pages live in `app/content/help/*.md`; the pipeline is `app/content/markdown/` (options, plugins and the component map).
  - Front matter: `title`, `description` (≤160 characters, the meta description), `summary` (`og:description`, as `pageMeta`'s `preview`; the index's intro), `sourcePages` (wiki page titles, credited in the meta link and the licence line) and `lastReviewed` (`YYYY-MM-DD`, shown in the licence line). The build fails on front matter that doesn't match `helpFrontmatterSchema`.
  - `:::infobox{title="At a glance"}` holds one list of `**Label:** value` or `[Label](#section): value` items, which become the Infobox's rows. `:::cards` (the index only) holds one list of `[Title](/help/slug): description` items, which become link Cards. A note or warning with one paragraph renders it as the Alert's body. Any other directive, a missing infobox title or a stray `:name` text directive fails the build.
  - h2s and h3s get GitHub-style ids from their text (`#how-restricted-works`), and the module exports them as the contents. The infobox is rendered first and outside `.prose-bt`; the content before the first h2 is the intro; the TOC follows it.
  - Links: absolute URLs are external `Link`s (wiki URLs get the wiki mark and suffix); paths go through React Router. Links in the infobox are standalone, in the prose they are prose links.

### 10.3 Settings (`/settings`, signed-in only)

**Tag: FE1.** Its mutations need JS: without JS, a `<noscript>` warning Alert says "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it." Until the page has hydrated (and so always without JS) the buttons that submit or open the revoke dialog are disabled; the notice says why. Signed out, the page shows a prompt with a "Log in" button to `/auth/login?returnTo=/settings`. A blocked account sees only the blocked danger Alert, titled "Your account is blocked" (an h2), with the way forward: "You can't change your settings or suggest edits. If you think this is a mistake, contact the Bardic Torch team.", the last words a link to the contact form. If the root's `/v1/me` failed, the Profile section is a SectionError ("We couldn't load your profile.", Try again) and the tokens still load. If `GET /v1/tokens` fails (500, unreachable, malformed), the route's own error boundary replaces the page content inside the shell ("We couldn't load your settings", Try again, home); a 403 from it is a danger Alert in the tokens section. A session the API ended mid-visit (a 401 from a settings form) clears the session and runs the root loader again, so the header and the page show the signed-out state with "Log in" back to Settings. The document and its client-side `.data` answers are `Cache-Control: no-store` (so is every page and `.data` answer carrying the root's data while signed in).

The head is the h1 "Settings" with no tab row. Sections are separated by h2 plus rule. The page is single column, `max-w-form` (42rem).

1. **Profile**:
   - Field "Display name". Help: "Shown on your edits and in page history. Use your SCA name if you like. Up to 64 characters." (`DISPLAY_NAME_HINT`: the standing hint stays plain; the full rule below is for the error only). The rule is the API's: the value is NFC-normalised and trimmed, then it must be **1–64 characters** (Unicode code points) with **no control or invisible formatting characters** (Unicode Cc/Cf); the server takes at most 256 characters before normalising. The limits and the rule copy (`DISPLAY_NAME_RULE`, "Use 1 to 64 characters, without control or invisible formatting characters.", shown for an upstream rejection) come from `app/schemas/rules.ts` (`displayNameProblem`), shared by the zod schema, the proxy route and this page; that module has no zod, so the browser checks with the same function without loading it.
   - [Save changes] (primary).
   - **Success:** a toast "Display name saved.", and the new name shows in the field and the account menu.
   - **Errors:** inline field errors "Enter a display name." / "Display names can be up to 64 characters." / "Display names can't contain control or invisible formatting characters." (checked in the browser and by the proxy). An upstream 400 `invalid_request` becomes the inline error with the `DISPLAY_NAME_RULE` copy; the API's own `message` is never shown (it is not meant for end users). A 403 `user_blocked` shows the danger Alert "Your account is blocked, so you can't make changes. Contact the Bardic Torch team if you think this is a mistake." Any other failure, including a response the app didn't make (a platform 503) and no network (with the offline toast, §7.3), shows the danger Alert "We couldn't save your changes. Check your connection and try again.", and the typed name stays. A 401 means the session ended: the root loader runs again, so the header and the page show the signed-out state with "Log in".
   - There is no "Signed in with" row: neither the API (`Me` is `{id, display_name, role}`) nor the session knows the provider.
2. **API tokens**:
   - Intro (body-sm fg-muted): "Tokens let tools, such as an MCP client, read and suggest edits on your behalf. Treat them like a password."
   - **List** (≥md, a table; <md, a `ul role="list"` of Cards): Name · Prefix (the API's `prefix` field, `font-mono`, followed by "…") · Created · Last used ("Never") · [Revoke] (secondary-danger `sm`, `aria-label="Revoke token {name}"`).
     - A token with no name is shown as **"Token {prefix}…"**, both visibly and in the `aria-label`.
     - The API lists **active tokens only, newest first**, and tokens have no expiry or revoked state, so there are no "Expired" or "Revoked" badges and nothing to hide.
     - A user has at most **10 active tokens** (`ACTIVE_TOKEN_LIMIT`). Under a non-empty list, a body-sm fg-muted line says "You have {n} of 10 API tokens." At 10 the create form is replaced by an info Alert, "That's the most allowed. Revoke one to create another.", so the limit is never discovered by failing; the 409 below remains the backstop for a list another tab made stale.
   - **Empty:** the EmptyState in §11.3, without its action button: the create form, with its own "Create token", is directly below it.
   - **Create:** the field "Token name" (optional; help: "So you can tell your tokens apart, e.g. 'Laptop MCP'.") plus [Create token] (secondary). Inline at ≥md, stacked at <md.
     - The name is trimmed and may be up to **128 characters**; a blank name means no name (`TOKEN_NAME_RULE`: "Use 128 characters or fewer, or leave the name blank."). An upstream 400 `invalid_request` becomes the inline error with that copy.
     - **409 `token_limit_reached`:** a danger Alert "You already have 10 API tokens, the most allowed. Revoke one before creating another."
     - **403 `api_token_not_allowed`:** "API tokens can't manage API tokens. Log in on the website to do this." **403 `user_blocked`:** the blocked copy above. Both are danger Alerts next to the form.
     - **Anything else** (the service's trouble, a response the app didn't make, no network): "We couldn't create a token. Check your connection and try again.", with the offline toast when there is no network; the typed name stays. The list is reloaded only after a create or revoke that succeeded (or found the token already gone), so a failure can't turn into the settings error page.
   - **One-time reveal** (after create, from the `POST /api/tokens` response, never re-fetchable):
     ```
     ┌ success Alert ───────────────────────────────────────────────┐
     │ ✓ Token created. Copy it now — you won't see it again.        │
     │ ┌──────────────────────────────────────────────┐ [⧉ Copy]     │
     │ │ {the full token, exactly as the API returns it}            │
     │ │ (font-mono, bg-surface-sunken, select-all, wraps)│          │
     │ └──────────────────────────────────────────────┘             │
     │ [I've copied it] (secondary sm) — dismisses, clears the DOM   │
     └──────────────────────────────────────────────────────────────┘
     ```
     - The token is shown in a `readonly` textarea that wraps (`.wrap-anywhere`) and grows to the value (`field-sizing: content`; `rows={4}` where that isn't supported, which holds the 73-character value at 320 px), so no line of the secret is ever cut off, with `aria-label="New token value"`. Focus moves to it, with the value selected. If the clipboard refuses, a visible line says so and the value is selected again for copying by hand. "I've copied it" moves focus to the "API tokens" h2.
     - Copy uses `navigator.clipboard`. On success it swaps the icon to `IconCheck` with the text "Copied", and a polite status announces "Token copied".
     - The proxy response sets `Cache-Control: no-store`.
   - **Revoke:** the confirm Dialog (§6.22 copy). On success, the row is removed, a toast says "Token revoked.", and focus goes to the "API tokens" h2. A 404 `not_found` (already gone) shows "That token no longer exists. Reload the page to see your current tokens."
3. **No Appearance section.** The theme is set from the header or drawer toggle, which already says "Theme", so there is one toggle per page.

### 10.4 404 (`*` and loader 404s)

**Tag: FE2** (FE1 offered only the wiki).

- **h1:** "We couldn't find that page".
- **Body:** "It may have moved, or the link may be mistyped. Pages from the old wiki don't redirect here yet, so try searching for it."
- **Actions:** [Go to the home page] (primary), [Search the catalogue for ‘{term}’] (secondary, to `/search?q={term}`; "Search the catalogue", to `/search`, when the address has no term) and the link "Look on the original wiki ↗", to `https://bardictorch.miraheze.org/w/index.php?search={term}` (URL-encoded, built from `navigation.ts`). The term is the last path segment, decoded, with `_` and `-` read as spaces and trimmed, so an old wiki address finds its page here.
- **Illustration:** the unlit torch (EmptyState art), at 64 px.
- It returns HTTP 404 and has no tab row. The footer HelpLinks are present, as on every page.
- **Built as:** `app/routes/$.tsx` (loader status 404) renders `NotFound` (`app/components/ErrorPages.tsx`) inside the shell. A 404 thrown by any loader reaches the root error boundary, which shows the same body on the standalone page (§10.5).

### 10.5 Error page (500 / unexpected)

**Tag: FE1.** The 503 variant is **FE2**.

- **h1:** "Something went wrong".
- **Body:** "That's on us, not you. Try again in a moment. If it keeps happening, let us know and include the reference below." (Without Sentry there is no reference, so the last clause is dropped.)
- The reference is the Sentry `eventId` in mono (§6.16). Actions: [Try again] (reload, primary) and [Go to the home page]. "Let us know" is the HelpLinks Contact link, not a separate one.
- **Layout:** the minimal header and footer around a `min-h-dvh` column. Below lg the body is full-bleed `bg-surface`, as in the shell; from lg it is a centred `max-w-form` sheet (`rounded-xl border shadow-1`, 40 px of canvas above and below), like every other page's sheet, rather than a slab hugging the left edge.
- **503 (API down):** h1 "Bardic Torch is resting", body "We're doing some upkeep or the catalogue is briefly unreachable. Please try again in a few minutes." Actions: [Try again] (primary; a reload link without JS) and [Go to the home page]. The art is the plain unlit torch (`art="missing"`), not the broken one, and there is no reference: an outage is logged by the server, never reported to Sentry. Built as `Resting` in `app/components/ErrorPages.tsx`, titled "Bardic Torch is resting · Bardic Torch" with `noindex` (`RESTING_META`). A loader signals it by throwing `data({kind: "resting"}, {status: 503})`; the root boundary shows it for that (`isResting`), and reports nothing. A catalogue route throws it with `throwPageFailure` (`app/catalogue/read-failure.ts`) for an upstream 503 or `unavailable` (`Retry-After: 60`), a network failure or the 10 s timeout (`Retry-After: 30`), and its own ErrorBoundary shows it inside the shell (`CatalogueError`, §10.7); every catalogue route exports `catalogueHeaders` as `headers`, which sends the `Retry-After` and keeps the root's `Cache-Control`.
- **Built as (FE1):** `ServerError` in `app/components/ErrorPages.tsx`. The root `ErrorBoundary` reports the error with Sentry's `captureException` after mounting (`useErrorReference`, starting Sentry first if the page failed on its first render) and shows the returned event id only when `Sentry.isInitialized()`. Only real errors are reported, never an error response (a thrown `data()`, such as a 404). The server reports the same error on its side (`handleError`, docs/DEPLOY.md §6).
- It is rendered within the shell. If the shell itself can't render (the root boundary), it uses a minimal standalone page with the same tokens and stylesheet, the Wordmark, and the **same HelpLinks block** (Contact · Help · Licence & attribution) as every other page (WCAG 3.2.6).

### 10.6 Styleguide (`/styleguide`, not linked from nav, `noindex`)

**Tag: SG** (exists in development, preview and e2e builds; excluded from production builds).

- Its sections follow this document: Colour (swatches showing name, hex for both themes and the contrast ratio, read from `tokens.ts`), Type scale, Spacing, Radii and elevation, Logo at 20/24/28/32 on all surfaces, then every §6 component with every state in a grid, including the SG and FE1-only states.
- A page-level in-page tablist, "Preview: Current / Light / Dark / Side by side", forces a `data-theme` on a wrapper.
  - This works because the token blocks also match `[data-theme]` on any element (§2.1). An e2e assertion checks that a forced-light panel under an OS-dark page has a computed `--bt-canvas` equal to the light value from `tokens.ts`.
  - Side-by-side renders both themes in two columns at ≥xl.
- Each component block has an anchor (`/styleguide#button`), which the screenshot checkpoints target one by one.
- **How it is built** (`app/routes/styleguide.tsx`, blocks in `app/styleguide/`):
  - `Gallery` renders the blocks in `SPECIMENS` order. Each block is a `Specimen` (a section named by its h2, with a one-line summary and its DESIGN section) holding `Example`s, one per state or variant, each captioned.
  - The preview tablist is the in-page `Tabs` (§6.9 b). It is `lazy`: only the selected panel renders its gallery, so the page holds one copy (two in Side by side) instead of five. The panels are Current (no wrapper, so it follows the page theme), Light and Dark (a `data-theme` wrapper on `bg-canvas`), and Side by side (both wrappers in `xl:grid-cols-2`). Each forced copy prefixes its anchors (`light-button`, `both-dark-button`, …), so the two Side by side copies never share an id; the unprefixed anchors are in Current, and they are the ones the checkpoints and `/styleguide#button` use. Without JS only Current is shown.
  - Colour swatches come from `COLOURS` in `tokens.ts`: the name, the resolved value in each theme and its contrast with `canvas` in each theme. The fill classes are written out in a `Record<ColourName, string>`, so a new token is a type error until it has a swatch.
  - ErrorState's page headings are h1s on a real page, so the styleguide shows them inside a framed example; the page's own h1 is "Styleguide".
  - The route sets `robots: noindex, nofollow`. The route config, `app/routes.ts`, adds `**/styleguide*` to `ignoredRouteFiles` in production mode only (tested in `app/routes.test.ts`), and `check:prod-build` fails unless `routes/styleguide` is absent from the production server build and client manifest and present in preview.
  - `test/component-usage.test.ts` fails if anything exported from an app module (`app/components/` included) is imported only by tests. Components that no FE1 page uses yet (the SG ones) are used here.
- **e2e** (`e2e/stub/styleguide.spec.ts`, the e2e build): one checkpoint per block (`checkpoint(page, id, { target: "section#id" })` scopes axe and the screenshot to the block), plus `account-menu-open-{signed-in,unavailable,blocked}`, `dialog-open` and `drawer-open`.
- **States in the checkpoints.** The examples are the rest, disabled, loading, error and pressed states. Each block with a control is captured with its first control focused by keyboard, so a real `:focus-visible` ring is on record (the spec asserts it matches). The error-summary block is captured after a keyboard submit, with the focused summary. The toast block is captured as the viewport with one toast of each tone, held on screen by focus on a dismiss button. Each AccountMenu panel is captured open, one per state. The open Dialog and Drawer are opened by keyboard and captured as the viewport, so the initial focus ring and the scrim show. **Hover is not recorded:** a static capture can hold one pointer position, and the checkpoint moves the pointer to the corner before every capture, so no hover left by a click shows. Hover styles are covered by their classes (unit tests) and the contrast table (§2.7). During an element capture the sticky header and the app bar are hidden, so they are never stitched over a specimen. It also covers the real focus trap, Escape, the backdrop rules and focus return for Dialog and Drawer, the Drawer's placement below and above md, toast placement and timing, the forced-light/forced-dark preview, Windows forced colours (`emulateMedia({ forcedColors: "active" })`: button edges, checkbox `appearance: auto` with the drawn marks hidden, outlines on current, pressed and selected, the focus ring) and the WCAG 1.4.12 text-spacing override (nothing clipped, no horizontal overflow at 360 and 320 px).

### 10.7 Piece browse and A–Z (`/pieces`)

**Tag: FE2.** Every piece by title: the catalogue's A–Z index, its search and (C2.2) its filters. The URL is the state (`pieceQuery` in `app/catalogue/query-state.ts`): `q`, `term`×n, `kind`×n, `status`×n, `stub`, `letter`, `sort`, `page`, in that order. A URL that means something else is answered with one 301 to its canonical form, a page past the data with one 302 to the last page; an order-only difference is answered 200, with `<link rel="canonical">` to the ordered form.

- **Page head:** h1 "Pieces", the single-view Read label, and the meta "{n} pieces" (`formatCount`, `app/catalogue/format.ts`).
- **Then, in DOM order:**
  1. the search box: its own `<Form method="get" action="/pieces" role="search">` ("Pieces"), an `Input type="search" name="q"` named "Search pieces" (44 px) and a secondary "Search" submit. It carries `term`, `kind`, `status` and `stub` as hidden inputs (each only when set) and drops `letter`, `sort` and `page`, so a search covers every letter from page 1 (`PieceSearch`). It is `CatalogueSearch`, which `/bards` shares (§10.10), so both look and behave alike: the field has a leading `IconSearch` and no placeholder (its name is "Search pieces"); Enter or Search goes to the canonical URL with focus kept in the field (the form is never remounted); Escape empties the field without leaving the page, in every browser; Search with it empty drops `q`; and the field follows the page's `q`, so a chip, "Clear search" or Back that changes it is shown in the box;
  2. the LetterBar (§6.29), "Pieces by letter";
  3. with `q` and at least one result, the order: a "Sort by" Select, "Best match" (relevance, the default) or "Title A–Z", belonging to the facet form (§6.28): applied on change with JS, by its "Sort" button without (`PieceSort`);
  4. the selected filters: one chip per value, a link to the list without it ("Search: ‘kettle’ ✕", "Mood: Warlike ✕", "Kind: Song ✕", "Conservation: Endangered ✕", "Stubs only ✕" / "Hiding stubs ✕", "Letter: W ✕"), then "Clear all", all `rel="nofollow"`, under a hidden h2 "Selected filters" (`SelectedFilters`, `app/components/facets/`); below xl, the "Filters" link (§6.28); then, for a link with categories that no longer exist, the info Alert "Some categories in this link no longer exist, so we left them out: ‘{slug}’.";
  5. the results: a section named by its h2 ("All pieces", "Pieces under T", "Results for ‘kettle’", "Matching pieces"), marked `aria-busy` during a same-route navigation (the old results stay), with a polite status right under the h2 (`ResultsStatus`): with results it is shown, `body-sm text-fg-muted tabular-nums` ("Showing {n} pieces", "Showing 51–100 of 249 pieces"), and the stale-category notice is said after it but not shown (the Alert shows it); with none it is `sr-only` ("No results", "No pieces match these filters"), because the EmptyState shows it. `/bards` and `/collections` show theirs the same way;
  6. the rows (`PieceListItem`, a `ul role="list"`, not Cards): the title as a standalone link to `/pieces/{slug}`, then "Song · Dance music", the static `sm` ConservationBadge (not while `unassessed`) and "Stub" (`caption text-fg-subtle`); a restricted piece shows its Restricted badge and no other link;
  7. Pagination (§6.20) over at most 201 pages; when the list is longer, the caption "Showing the first 10,050. Narrow your search to see the rest." (`ListPagination`);
  8. the filters, `<section id="filters">` (FacetForm, §6.28), the left column from xl.
- **With JS** the two forms never submit themselves: they navigate straight to the canonical URL (`canonicalFormHref`, `app/catalogue/form-href.ts`), one request, never a 301. Without JS they GET in DOM order, which is answered 200.
- **Empty:** with `q`, "Nothing matches ‘{q}’" / "Try a shorter search, or browse by mood or topic." / [Browse pieces]; with a letter or filters, "No pieces match these filters" / "Try removing a filter." / [Clear all filters]; with nothing set, "No pieces yet".
- **Errors** (`app/components/catalogue/CatalogueError.tsx`, kinds from `ReadFailure`):
  - the API refused a filter (400): the page is "We couldn’t apply these filters" (h1, HTTP 400) / "One of the filters in this link isn’t valid any more." / [Clear all filters], then the search box and chips (`FilterError`);
  - a 500 to a search or a filter: "That search took too long" (HTTP 500) / "Try fewer words or fewer filters, or browse by category." / [Try again], then the search box and chips (`FilterError`);
  - a 500 to the plain A–Z or a letter: ServerError "We couldn’t load the pieces" (`CatalogueError`, the route's ErrorBoundary);
  - an outage, a network failure or a timeout: the resting page (§10.5), 503 with `Retry-After`;
  - an answer we can't read (502): "Something went wrong" / the unexpected-answer copy / [Try again].
    The failure pages are titled by their h1 and `noindex`; the API's `message` is logged, never shown.
- **Stale categories** (plan §2.4): the terms and the pieces are read in parallel. A `term` the API refuses (deleted, unapproved or an affiliation) makes it answer 400; the page leaves out the slugs the terms don't list as piece categories, asks once more and shows the Alert above. A 400 that persists, or one with every slug known, is the "We couldn’t apply these filters" page; if the terms failed too, it adds their SectionError.
- **Meta:** title "Pieces", "Pieces under T", "Pieces matching ‘kettle’", with ", page 2" from page 2; canonical is the canonical URL. A search, a filter, an order or left-out categories are `noindex, follow` (with a self canonical); letter pages and later pages are indexable.

### 10.8 Piece page (`/pieces/:slug`)

**Tag: FE2.** `pieces.$slug.tsx` (the layout: `getPiece`, meta and JSON-LD, the boundary; it ignores search-only changes) and `pieces.$slug._index.tsx` (Read, `PiecePage` from the outlet). A slug that can't be one is our own 404, without an API call.

- **Head:** breadcrumbs "Pieces › {title}", the h1, the meta line "{Kind}{ · secondary kinds}{ · period}" ("Song · Dance music · 1580–1600"), Read / History.
- **Banners:** restricted (lock, "Read their statement ↗" from the newest restricted entry's source) or, if not restricted, stub ("How to contribute").
- **Infobox** "About this piece": Details (Kind with "also: …", Period, Also known as with the alias kind; redirects never shown), Credits (§6.30), Origin, Conservation (badge and status history), Licensing (the summary linked to `#licensing`). Empty rows are left out except Credits.
- **Sections** (the contents from four): Notes, Where to find it (or, restricted, Where it has been recorded), Performances (not restricted, when any), Licensing (the card), Versions, Historical source, Related pieces. With no links: "No links yet."; a stub's EmptyState "No links yet" / "Know where this piece lives online or in print? Add the first link." / [How to contribute].
- **Then** every term as a chip "Facet: Name" (12 shown, "Show all {n}"), and the licence line.
- **Meta:** the title, a description from the meta line, the canonical; a restricted piece is `noindex, nofollow` with no JSON-LD; any other has a schema.org `CreativeWork` (`MusicComposition` for songs, dance music and instrumentals) with its named credits (`author`; on a composition the tune's, music's and arrangement's as `composer`).
- **Errors:** "We couldn’t find that piece" (404, the NotFound body), "We couldn’t load this piece" (500), the resting page (503), "Something went wrong" (502), inside the shell, `noindex`.

### 10.9 Bard page (`/bards/:slug`)

**Tag: FE2.** `bards.$slug.tsx` and `bards.$slug._index.tsx`, as the piece's.

- **Head:** breadcrumbs "Bards › {name}", the h1, the meta line "{Community bard | Historical figure | Group}{ · pronouns}{ · Died / Disbanded {date}}", Read / History.
- **A person with no page:** the h1, the kind, the no-page banner (with "Read their statement ↗" when there is a source), the single Read label, no infobox or sections, the licence line without the history; `noindex, nofollow`, no JSON-LD.
- **Otherwise:** the stub banner when a stub; the infobox "About this bard" ("About this group"): Also known as (Name, SCA name, Stage name, Nickname, Former name), Roles, Affiliations (chips), Website (the `website` links), Status (not active only), Licensing; the sections About, Licensing, Works, Performances, Relations, Links (external profiles first); the licence line. JSON-LD `Person` or `MusicGroup` with `sameAs` the websites and profiles.

### 10.10 Bards directory (`/bards`)

**Tag: FE2.** `bards._index.tsx`, on `/pieces`' pattern (§10.7): `personQuery` (`q`, `kind`×n, `role`×n, `affiliation`, `letter`, `sort`, `page`), one 301 to the canonical form, one 302 past the end.

- h1 "Bards" with "{n} bards", the search box (`BardSearch`, keeping kind, role and affiliation; the same `CatalogueSearch` as `/pieces`', field "Search bards", with the same button, Escape, kept focus and following of `q`), the LetterBar "Bards by letter", the chips (`Search:`, `Kind:`, `Role:`, `Affiliation:`, `Letter:`), then from xl two columns: the results (PersonListItem rows, `aria-busy` during a same-route navigation, ResultsStatus "Showing {n} bards", shown under the heading when there are results as on `/pieces`, Pagination) and the filters.
- **Filters** (`BardFilters`): a GET form in a Disclosure "Filters" after the results (closed; with JS at xl opened, and a change applies at once): Kind and Role checkboxes, the Affiliation select (affiliation terms in tree order, "— " per level; "Any affiliation"), "Apply filters"; hidden `q`, `letter` and `sort` when set; keyed on the canonical query. If the terms fail, the select is a SectionError "We couldn’t load the affiliations" and the list still shows.
- **A stale affiliation** (the API's 400 for an affiliation the terms no longer have) is left out with one re-query and an info Alert "That affiliation no longer exists, so we left it out." (`noindex, follow`).
- **Empty:** with `q`, "Nothing matches ‘{q}’" / "Try a shorter search." / [Clear search]; with filters or a letter, "No bards match these filters" / "Try removing a filter." / [Clear all filters].
- **Errors** as `/pieces`: a 500 to a search or filter is "That search took too long"; to the plain A–Z, "We couldn’t load the bards".

### 10.11 Search (`/search`)

**Tag: FE2.** The catalogue-wide search, the SearchBox's target (`app/routes/search.tsx`, plan §4.4). The URL is only `q` (`searchQuery`: trimmed, cut at 200 code points; anything else is a 301).

- **Head:** h1 "Search", then the `lg` SearchBox prefilled, and a polite `sr-only` status: "{n} pieces, {m} bards and {k} categories match ‘{q}’" (`formatCount`), counting only the sections that loaded, or "No results".
- **Sections**, each a `<section>` named by its h2, read in parallel: **Pieces** (the top 10 `PieceListItem`s, then "See all {n} pieces" to `/pieces?q=` when there are more), **Bards** (the top 10 `PersonListItem`s, then "See all {n} bards" to `/bards?q=`) and **Categories** (up to 12 TagList chips with their facet as the prefix, linking to `/categories/{slug}`, then "and {n} more"). `listTerms` has no `q`: the terms are matched in `app/catalogue/term-search.ts` (case, accents and Þ/Æ/ß-style letters folded; every word of 3 letters or more, stopwords aside, must start a word of the display name, full name or facet label; with none, a prefix of the name). A section with nothing says "No pieces match." (etc.).
- **Empty `q`:** h1, the SearchBox and "Type a word from a title, a name or a category."; no API call. **Nothing anywhere:** the §11.3 EmptyState "Nothing matches ‘{q}’" / "Try a shorter search, or browse by mood or topic." / [Browse pieces].
- **Failures:** each section fails on its own, with a SectionError: a 500 to a search is "That search took too long" / "Try fewer words."; anything else "We couldn’t load the pieces" (bards, categories), with "The catalogue is briefly out of reach. Try again in a few minutes." for an outage. When all three fail, the page is the resting page (503, `Retry-After`) if all were outages, otherwise ServerError "We couldn’t load the search results" (500), inside the shell.
- **Meta:** "Search: {q}" (or "Search"), `noindex, follow`, canonical `/search?q=`.

### 10.12 Categories index and category page (`/categories`, `/categories/:slug`)

**Tag: FE2.** The URL state is `categoryIndexQuery` (`facet`) and `termMembersQuery` (`page`) in `app/catalogue/query-state.ts`.

- **Index:** h1 "Categories", the single-view Read label, then the "Category sections" nav (a `sm` TagList: "All categories", Kind, the eight piece facets, Affiliation, Conservation status; the shown one is current), then one section per facet, each named by its h2:
  - the term facets: a `TermTree` (`app/components/TermTree.tsx`): a nested `ul role="list"`, each term a compact link to `/categories/{slug}` followed by its count "(31)" in `body-sm text-fg-subtle` (`aria-hidden`, with an `sr-only` "31 pieces", or "4 bards" for an affiliation), each child list indented `pl-4` on a `border-l border-border` rule. A term shows its `display_name`, or its full `name` ("Story (Mood)") where two terms of the facet share one. A facet with no terms: "No categories here yet." (`body-sm text-fg-subtle`);
  - Kind: each kind with pieces, linking to `/pieces?kind=…` with its count;
  - Conservation status: every status (the help page's order) as a static `sm` ConservationBadge (`named`) followed by a link "Browse endangered pieces" (…) to `/pieces?status=…` and its count. The badge is not the link (§6.13's link variant goes to the help page);
  - the kind and status counts are one region (`listPieces?limit=1`): if they fail, a SectionError "We couldn’t load the kinds and conservation statuses" stands in for both and the tree still shows (200).
- **One section** (`?facet=mood`, the sidebar's facet links): the breadcrumb "Categories › Mood", h1 the section's label, the meta "{n} categories", the section's body with no h2. `kind` and `conservation` are never sent to `listTerms`.
- **Category page:** `EntityPage` with breadcrumbs "Categories › {Facet} › {ancestors…} › {name}" (collapsing below sm, §6.19), h1 the `display_name`, the meta "Topic · 12 pieces" ("Affiliation · 3 bards"), Read / History; on Read only: the infobox ("Also called", "Part of" the parent, "Related affiliation"; left out when none applies), the description, "Subcategories" (chips "Battles (3 pieces)"), the members (a section "Pieces" or "Bards": the count, "Filter these pieces" → `/pieces?term=…` or "Search these bards" → `/bards?affiliation=…`, `PieceListItem` or `PersonListItem` rows, `ListPagination`), the chip row (the ancestors and the term itself, current), and the `LicenceLine`. No members: EmptyState "Nothing here yet" / "No pieces are in this category yet." / [Browse pieces] (for an affiliation "No bards are in this affiliation yet." / [Browse bards]).
- **Errors:** an invalid slug is our own 404 "We couldn’t find that category" (no call); a failed head is the page's error (§10.7's kinds); a failed members read is a CatalogueError under the head ("We couldn’t load the members of this category").
- The description (`description_md`), here and on the collection and event pages, is rendered from the sanitised tree the layout's loader makes of it (`renderMarkdown`, C4.2) by `UserMarkdown`, like a piece's notes.

### 10.13 Collections directory and collection page (`/collections`, `/collections/:id`)

**Tag: FE2.** The URL state is `collectionQuery` (`kind`×n, `letter`, `page`); ids are positive int64 decimals (`isEntityId`), anything else our own 404.

- **Directory:** h1 "Collections", the Read label with "{n} collections", the LetterBar ("Collections by letter"), the selected-filter chips (`Kind: Wiki`, `Letter: H`, Clear all), the results ("All collections", "Collections under H", "Matching collections"; the API's order, never re-sorted) with the ResultsStatus "Showing {n} collections" shown under the heading when there are results (§10.7), Pagination, then the kind filter: a `<details>` "Filter by kind ({n} selected)", open while a kind is chosen, holding a GET form of 13 checkboxes ("Kind") and a secondary `sm` "Apply filters" (`CollectionKindFilter`, keyed by the canonical query). Each row: the name (compact link), the kind label, "Made for bards" (caption with `IconBook2`) and "Visit" (a `userContent` link, named "Visit {name}").
  - Empty with a filter: EmptyState "No collections match these filters" / "Try another letter or kind." / [Clear all filters].
  - A 500 to a kind filter: "That search took too long" with the chips and the filter kept; a 400: "We couldn’t apply these filters"; a 500 to a letter or the whole list is the route's ServerError.
- **Collection page:** EntityPage with breadcrumbs "Collections › {parent} › {name}", the meta "{kind}{ · region}", Read / History; on Read the infobox (Where, Region as a chip, Part of, Contents can be listed, Made for bards), the description, "Part collections", "Citations" and the LicenceLine.
- **Citations** (`app/components/Citations.tsx` on `RowTable`, `app/components/catalogue/RowTable.tsx`: a table from md, cards below, one displayed at a time like the token list): Piece or bard (internal link and kind; a restricted piece with its `sm` Restricted badge), Link (title, or the URL, a `userContent` link), Where (the locator), Roles. A restricted piece's link is "Link not shown: see the piece page" (`text-fg-subtle`), and the loader empties its URL and title (`withoutRestrictedLink`), so they never reach the page. Past the cap: "and {n} more". None: "Nothing cited from this collection yet."

### 10.14 Events and venues (`/events`, `/events/:slug`)

**Tag: FE2.** The URL state is `eventQuery` (`kind`: `venue` or `event`, `page`). The API has no A–Z or search for events (spec issue B10).

- **Directory:** h1 "Events and venues", the Read label with "{n} events and venues", the "Kinds" switch (a `sm` TagList: All, Events, Venues; the shown one current), the list ("All events and venues", "Events", "Venues", with the visible result count under its h2, as on the other directories: "Showing 1–50 of 160 events and venues", `sr-only` when nothing is listed), each name a compact link, then its kind, Pagination. None of a kind: EmptyState "No venues recorded yet" (or "No events recorded yet") / "Try the other kind, or all of them." / [Show all events and venues]. Every failure is the route's error (a 500 is "We couldn’t load the events and venues", never the slow-search copy).
- **Event page:** EntityPage with breadcrumbs "Events and venues › {name}", the meta "Event" or "Venue", Read / History; on Read the description, "Performances recorded here" and the LicenceLine.
- **Performances** (`app/components/EventPerformances.tsx` on `RowTable`), in the API's order (newest year first, unknown last): Year ("Unknown"), Piece (a link, or "No particular piece"; a restricted piece with its badge), Performers (links), Recording (the title, or the URL, with "(platform)", a `userContent` link). A restricted piece's recording is "Link not shown: see the piece page", and the loader empties it. Past the cap: "and {n} more". None: "No performances recorded here yet."

### 10.15 History (`…/history`)

**Tag: FE2.** The History view of every entity, under its layout's head (History current), `noindex, follow` (`noindex, nofollow` for a restricted piece), titled "History of {name}". `historyQuery` pages it 50 at a time (`page`), and one loader serves them all (`loadHistory`, `app/server/history.server.ts`).

- **Pieces and bards** (`/pieces/:slug/history`, `/bards/:slug/history`): their layouts (§10.8, §10.9) hand the entity to their views through the outlet, so the History view draws the same head as Read (`pieceHead`, `personHead`: breadcrumbs, h1, meta line and the restricted, stub or no-page banner) without the Read parts. A person who prefers not to have a page has no History tab (§10.9, plan R8), but the address still works.

- An h2 "History", the meta "{n} revisions", then `RevisionHistory` (`app/components/RevisionHistory.tsx` on `RowTable`): When (`<time datetime>`, "10 Mar 2026"), Who (`revisionCredit`: the author, "… (via the MCP tool)", "Imported from the original wiki, by Archivist and Lorekeeper", or "Unknown"), Summary (or "No summary" in `text-fg-subtle`), and "View changes" (named "View changes, revision {id}") → `/revisions/{id}`; then Pagination.
- None: EmptyState "No history yet" / "Changes to this page will be listed here."
- A failed read shows under the head: 404 the entity's 404, 500 "We couldn’t load the history", the resting page, 502.

### 10.16 Revision (`/revisions/:id`)

**Tag: FE2.** One approved revision of any entity type, named by the entity as it is now; `noindex, follow`, titled "Revision {id} of {title}".

- **Head:** breadcrumbs "{section} › {title} › History › Revision {id}", h1 "Revision {id} of {title}", the meta "{date} · {who}" (`revisionCredit`), the summary in a `blockquote` (`border-l-3 border-border-strong`) when it has one, then the links "View the {piece|bard|category|collection|event|venue} as it is now" and "Previous revision" (when there is a base).
- **The caveat**, always: an info Alert "This is how the revision looks today." / "Anything that has since been hidden, made private or removed is left out, so it may differ from what was saved at the time."
- **The changes** (`RevisionDiff`, `DiffRow` in `app/components/revision/`, from `revisionChanges` in `app/catalogue/diff.ts`): h2 "Changes" (or "First recorded version" with "These are the fields this revision set."), then one section per changed field, its label an h3: a scalar as Before / After (`dl`, side by side from sm; "—" for none), a text field as one block of its Markdown source marked word by word (`wordDiff`, `app/catalogue/word-diff.ts`: Myers' O(ND), bounded at 1,500 words a side and 500 edits): removed words in `<del>` (struck through, `danger-bg`/`danger-fg`, `IconMinus`, a hidden "removed:"), added ones in `<ins>` (`success-bg`/`success-fg`, `IconPlus`, a hidden "added:"); past the bounds, or with one side empty, two whole blocks Before / After (`font-mono` on `surface-sunken`), a list as items marked "Added" (`IconPlus`, `success-bg`/`success-fg`), "Removed" (`IconMinus`, `danger-bg`/`danger-fg`) or "Changed" (`IconPencil`, `surface-sunken`; "before → after", read ", now"), never colour alone. With no base, the values alone, unmarked. A person's profile is a row per sub-field that differs ("Profile: Roles"), with "Identity only (the person prefers not to have a page)" for a side with none.
- **Links** in the diff are `userContent` links, except in a restricted piece's revision (restricted now or in either snapshot), where every link is its title or host as text and a caption says why, and a person's links that carry performances (B14), text with their pieces linked inside the site.

## 11. Voice and microcopy

### 11.1 Voice

- **Friendly and plain.** Write like a helpful herald at a bardic circle: warm and clear, never cute, never legalese. Mild heritage flavour is welcome in headings and empty states, for example "Keep the torch lit". Avoid it in errors, buttons and labels.
- **Use British/International English spelling.** "Licence" is the noun and "license" the verb; also "colour", "organisation", "catalogue", "favourite", "centre".
- **Sentence case** everywhere: "Create token", "FAQ for bards", "Licence & attribution". Proper nouns keep their capitals (Bardic Torch, SCA, Creative Commons). Never use Title Case or ALL CAPS in source text. The `label-caps` style is CSS-only, and screen readers read the sentence-case source.
- **Address the reader as "you" and the project as "we".**
- **Buttons start with a verb** and say what will happen: "Save changes", "Revoke token". Don't use "OK", "Submit" or "Yes".
- **Typographic punctuation in copy:** the apostrophe ’ (U+2019), and British quotes ‘…’ with “…” inside them; never the straight `'` or `"` (this document's own examples use straight quotes). This covers JSX text, strings shown in the UI or logs, and the help pages' Markdown outside code. `test/typographic-quotes.test.ts` enforces it.
- **Use numbers as numerals, and dates as "3 Oct 2026".** Relative dates ("3 days ago") always have the absolute date in a `<time datetime>` `title`. Use the `en-GB` locale for formatting.
- **Respect bards.** Credit names exactly as the bard uses them. Say "creator's wishes", never "restrictions" in user-facing text, apart from the formal status name "Restricted".
- Don't use exclamation marks, except in a thank-you.

### 11.2 Errors

The pattern is: what happened, then what to do. Don't blame the reader, and don't show codes, except as a reference.

| Situation                             | Write                                                                                                | Not                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Required field empty                  | "Enter a display name."                                                                              | "Display name is required" / "Invalid input" |
| Too long                              | "Display names can be up to 64 characters." (the number comes from the shared constant)              | "Max length exceeded"                        |
| Server rejected a field               | The field's rule, e.g. "Use 1 to 64 characters, without control or invisible formatting characters." | The API's `message`                          |
| Token limit reached                   | "You already have 10 API tokens, the most allowed. Revoke one before creating another."              | "409 Conflict"                               |
| URL invalid (future)                  | "Enter a full web address, starting with https://"                                                   | "Malformed URL"                              |
| Save failed                           | "We couldn't save your changes. Check your connection and try again."                                | "Error 500"                                  |
| Session expired                       | "You've been signed out. Log in again and we'll bring you back here."                                | "Unauthorised"                               |
| Rate limited                          | "That's a lot of changes at once. Wait a minute, then try again."                                    | "429 Too Many Requests"                      |
| Offline                               | "You seem to be offline. Your changes haven't been saved yet."                                       | "Network error"                              |
| Theme save failed                     | "Couldn't save your theme. Try again."                                                               | —                                            |
| Profile couldn't load (account panel) | "We couldn't load your profile. Try again"                                                           | "Failed to fetch /v1/me"                     |

### 11.3 Empty states

| Where                    | Title                   | Body                                                                             | Action                                   |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| API tokens               | "No tokens yet"         | "Create a token to let tools like an MCP client work with Bardic Torch for you." | Create token                             |
| No search results (FE2)  | "Nothing matches '{q}'" | "Try a shorter search, or browse by mood or topic."                              | Browse pieces                            |
| No categories            | —                       | "No categories yet."                                                             | Edit (if editable)                       |
| Stub with no links (FE2) | "No links yet"          | "Know where this piece lives online or in print? Add the first link."            | How to contribute (until FE3 adds links) |

### 11.4 Fixed strings

- Non-affiliation: "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
- Licence on edit forms (FE3): "By saving, you agree to release your contribution under CC BY-SA 4.0."
- External old-wiki link suffix (screen readers): "(opens original wiki)". Other external links: "(external link)".
- Settings without JS: "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it."
- Theme toggle group label: "Theme". Options: "System", "Light", "Dark".

---

## Appendix A: Tailwind theme

`scripts/build-tokens.mjs` writes the Tailwind 4 theme into `app/styles/tokens.css`, after the per-theme variables, from `app/styles/tokens.ts` and the tables in `scripts/tailwind-theme.mjs`; `npm run check:tokens` byte-checks it. The `@theme` block starts with `--*: initial`, which clears every Tailwind default, so only what is listed here exists: no default palette, size scale, radii, shadows, durations or animations.

- **Spacing** is Tailwind 3's default scale plus `13`, written as named keys (`--spacing-4: 1rem`) with no bare `--spacing`, so `p-17` or `mt-13.5` are not classes.
- **Every other namespace** of Tailwind 4's theme (read from `tailwindcss/theme.css` when the file is generated) gets Tailwind 3.4's default values, which the design was drawn on: `--breakpoint-*` (`sm` 640 px … `2xl` 1536 px), `--font-weight-*`, `--leading-*`, `--tracking-*`, `--container-*` (`max-w-xs` … `max-w-7xl`), `--blur-*`, `--aspect-*`. `--drop-shadow-*` stays empty, because Tailwind 3's drop shadows are raw black (§2.1). `--inset-shadow-*`, `--text-shadow-*` and `--perspective-*` stay empty: Tailwind 3 had none.
- **Utilities on fixed scales.** Tailwind 4 makes a class for any number or fraction after some utilities (`z-37`, `border-5`, `opacity-33`, `w-5/7`). Lint (`better-tailwindcss/no-restricted-classes`) and `test/tailwind-classes.test.ts` allow only FE1's values, listed in `scripts/tailwind-classes.mjs`.

| Theme namespace or utility           | Classes                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-*` (inline)                 | `transparent`, `current`, `inherit`, plus every token in §2.3–2.5: `bg-canvas`, `text-fg-muted`, `border-border-strong`, `outline-focus`, `fill-accent`, `bg-info-bg`, `text-cons-low-fg` … Each is `rgb(var(--bt-name))`.                                                                                       |
| `--font-*`                           | `font-display`, `font-sans`, `font-mono`. `--default-font-family` is the sans stack and `--default-mono-font-family` the mono stack.                                                                                                                                                                             |
| `--text-*` (inline)                  | `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-label-caps` (always used with `uppercase`), `text-code`, `text-wordmark`. Each sets size (a CSS variable that changes at `md`), line height, letter-spacing and weight.           |
| `--radius-*`                         | `rounded` (= `md`), `rounded-none`, `rounded-sm` (4 px), `rounded-md` (6 px), `rounded-lg` (10 px), `rounded-xl` (16 px), `rounded-full`                                                                                                                                                                         |
| border widths (fixed scale)          | `border` (1 px), `border-0`, `border-2`, `border-3`                                                                                                                                                                                                                                                              |
| `--shadow-*` (inline)                | `shadow-none`, `shadow-1`, `shadow-2`, `shadow-3` (`var(--bt-shadow-n)`), `shadow-current-bar` (the current nav item's inset 3 px `accent` bar, §5.3)                                                                                                                                                            |
| `--transition-duration-*` (inline)   | `duration-instant`, `duration-fast`, `duration-base`, `duration-slow`, `duration-flicker` (default: instant)                                                                                                                                                                                                     |
| `--ease-*` (inline)                  | `ease-standard`, `ease-out`, `ease-in` (default: standard)                                                                                                                                                                                                                                                       |
| `--animate-*` and their `@keyframes` | `animate-spin`, `animate-pulse-soft`, `animate-shimmer`, `animate-progress`, `animate-flicker`, `animate-fade-in` (120 ms, the reduced-motion entrance), `animate-dialog-in`, `animate-toast-in` (180 ms), `animate-sheet-in`, `animate-drawer-in` (240 ms)                                                      |
| `--spacing-*`                        | the scale above; `13` (3.25rem, 52 px): `min-h-13`, `w-13` for `lg` buttons                                                                                                                                                                                                                                      |
| `--max-width-*`                      | `max-w-prose` (68ch), `max-w-form` (42rem), `max-w-shell` (90rem)                                                                                                                                                                                                                                                |
| `@utility` (max height)              | `max-h-sheet` (85dvh, the bottom-sheet drawer), `max-h-below-header` (`calc(100dvh - var(--bt-header-h))`, the sticky sidebar)                                                                                                                                                                                   |
| `@utility` (inset)                   | `top-toast` (`calc(var(--bt-header-h) + 0.5rem)`, toasts below sm), `top-header` (`var(--bt-header-h)`, the sticky sidebar), `bottom-above-app-bar` (`calc(var(--bt-app-bar-h) + env(safe-area-inset-bottom) + 1rem)`, toasts from sm to md)                                                                     |
| `@utility` (grid)                    | `grid-cols-infobox` (`7rem minmax(0, 1fr)`, infobox rows), `grid-cols-shell` (`15rem minmax(0, 1fr)`, sidebar and main at lg), `grid-cols-shell-xl` (`16rem minmax(0, 1fr)`), `grid-rows-shell` (`1fr auto`), `grid-cols-browse` (`16rem minmax(0, 1fr)`, the facet column and the results on `/pieces` from xl) |
| `@utility` (height)                  | `h-header` (`var(--bt-header-h)`), `h-app-bar` (`calc(var(--bt-app-bar-h) + env(safe-area-inset-bottom, 0px))`, the bar's whole box), `h-text-line` (0.75em), `h-progress` (3 px, the navigation progress bar)                                                                                                   |
| `@utility` (min height)              | `min-h-textarea` (7.5rem)                                                                                                                                                                                                                                                                                        |
| `@utility` (width)                   | `w-dialog` (`min(32rem, calc(100vw - 2rem))`), `w-drawer` (`min(20rem, 85vw)`), `w-infobox` (16.5rem), `w-infobox-xl` (20rem)                                                                                                                                                                                    |
| `@utility` (underline offset)        | `underline-offset-prose` (0.2em)                                                                                                                                                                                                                                                                                 |
| `@utility` (background image)        | `bg-hero`: the home hero's radial glow, `hero-glow` at the top left fading to transparent over `surface` (§10.1); `bg-shimmer`: the skeleton sweep (§6.18); `bg-fade-up`: `canvas` clearing upwards, the sidebar's "more below" fade (§5.3)                                                                      |
| `@utility` (padding)                 | `pb-safe-b` (`env(safe-area-inset-bottom, 0px)`, bottom sheets), `pb-app-bar` (the same as `h-app-bar`: room for the whole bottom app bar under the page below md)                                                                                                                                               |
| `@utility` (transform origin)        | `origin-flame` (`50% 90%`, the logo flicker; with the `transform-box-fill` utility in `base.css` so it is measured on the flame, not the viewBox)                                                                                                                                                                |
| `@utility` (z-index)                 | `z-header` (30), `z-progress` (40), `z-toast` (50)                                                                                                                                                                                                                                                               |
| `@utility` (colour at an alpha)      | `bg-fg-10`, `bg-scrim-scrim` (the scrim at `--bt-scrim-alpha`), `decoration-link-40`, `decoration-link-visited-40`, `decoration-fg-subtle-50`: `<utility>-<colour>-<alpha>`, writing `rgb(var(--bt-colour) / alpha)`. Tailwind 4's `/40` modifier would mix the colours in oklab instead.                        |
| `@utility` (stacks)                  | `stack-y-1`, `stack-y-3`, `stack-y-4`, `stack-y-6`: a top margin on every child after the first without a `hidden` attribute, as Tailwind 3's `space-y-*` (Tailwind 4's puts the margin on the other side).                                                                                                      |

Other theme settings: hover styles apply only where the primary pointer can hover precisely (`@custom-variant hover` in `app/styles/app.css`: `(hover: hover) and (pointer: fine)`). `transition-colors` leaves out the outline colour, so a focus ring is drawn at once. `--default-ring-width` is 3 px. The `dark:` variant is never used, and no stylesheet may define one (§2.1; `test/no-raw-colours.test.ts` rejects both). Gradient utilities (`bg-linear-*`, `from-*`, `via-*`, `to-*`), which interpolate in oklab, and `space-*`/`divide-*` are refused by lint: each gradient is a named background image above.

In this theme, the colour named `border` gives `border-border`. That is intended and is the documented class.

**Where the styles live:**

- `app/styles/tokens.ts`: the token source (hand-written).
- `app/styles/tokens.css`: generated: the `--bt-*` custom properties (colours per theme, shadows, type sizes, motion, layout), then the `@theme` and the `@utility` rules above.
- `app/styles/fonts.css`: the Fraunces `@font-face` rules and the metric-matched fallback faces.
- `app/styles/base.css`: element defaults (`html`, `body`, `::selection`, `::placeholder`, button cursors, table-cell padding, the search field, headings), `scroll-padding`, the global `:focus-visible` ring, the `opsz-32` utility (wordmark), the `summary-plain` and `transform-box-fill` utilities (logo flicker), `scroll-padding-bottom` below md (bottom app bar), forced-colours rules and the smooth-scroll rule (inside `prefers-reduced-motion: no-preference`). `wrap-anywhere` (`overflow-wrap: anywhere`, for token names and secrets on Settings) and `field-sizing-content` are Tailwind's own.
- `app/styles/prose.css`: the `.prose-bt` component class (§3.3).
- `app/styles/app.css`: the entry. It `@import`s Tailwind (with sources limited to `app/`), then the files above, and defines the `hover` variant. `root.tsx` links it with `links()` as a render-blocking stylesheet.

## Appendix B: Token CSS shape

This is the shape of `app/styles/tokens.css` as `scripts/build-tokens.mjs` writes it from `app/styles/tokens.ts` (the `@theme` and `@utility` rules that follow are Appendix A). Colour values are channel triplets, so a colour can be written at any alpha.

```css
/* @generated by scripts/build-tokens.mjs from app/styles/tokens.ts — do not edit. Run `npm run gen:tokens`. */
:root,
[data-theme="light"] {
  color-scheme: light;
  --bt-canvas: 247 242 232; /* #F7F2E8 */
  --bt-fg: 43 33 24; /* #2B2118 */
  --bt-accent: 168 71 12; /* #A8470C */
  /* …every colour token in §2.3–2.5… */
  --bt-input-bg: var(--bt-surface-raised);
  --bt-shadow-1: 0 1px 2px rgb(60 40 20 / 0.06), 0 1px 3px rgb(60 40 20 / 0.08);
  --bt-shimmer-alpha: 0.6;
}
:root[data-theme="dark"],
[data-theme="dark"] {
  color-scheme: dark;
  --bt-canvas: 22 18 14; /* #16120E */
  --bt-fg: 228 217 198; /* #E4D9C6 */
  --bt-accent: 233 164 64; /* #E9A440 */
  /* … */
  --bt-input-bg: var(--bt-surface-sunken);
  --bt-shadow-1: inset 0 1px 0 rgb(255 236 210 / 0.04);
  --bt-shimmer-alpha: 0.35;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* the same declarations as the dark block, generated from the same map */
  }
}
:root {
  --bt-header-h: 3.5rem;
  --bt-text-h1: 1.875rem;
  --bt-dur-fast: 120ms;
  /* …type sizes, motion, layout… */
}
@media (min-width: 768px) {
  :root {
    --bt-header-h: 4rem;
    --bt-text-h1: 2.25rem;
    /* … */
  }
}
```

`base.css` then sets `html { background: rgb(var(--bt-canvas)); color: rgb(var(--bt-fg)); }` and `::selection { background: rgb(var(--bt-selection)); color: rgb(var(--bt-fg)); }`.
