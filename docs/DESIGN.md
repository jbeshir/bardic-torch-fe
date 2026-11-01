# Bardic Torch design system

**Status:** v2, for milestone FE1 (foundation). v2 folds in the design critique (items D1–D32) and aligns routes and names with the FE1 plan. **Owner:** product design. **Applies to:** `bardic-torch-fe` (Remix, Tailwind 3.4, Cloudflare Pages).

This is the reference for every visual and interaction decision in the frontend. Where it gives a value, use that value. Where it says MUST, a reviewer will check it. If something you need isn't covered, add it here in the same PR as the code. Don't improvise in a component.

**Milestone tags.** Every component (§6) and pattern (§7) carries one of these tags:

| Tag                      | Meaning                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE1**                  | Built, tested and wired into FE1 pages.                                                                                                                                                                                |
| **SG** (styleguide-only) | Built and tested in FE1 and shown on `/styleguide` in every state, but not wired into any FE1 page. The brief requires the component library, so these exist. Page-level wiring waits for the milestone that needs it. |
| **FE2+**                 | Specified here for later milestones. It is **not** built in FE1. Building it now would be a half-wired feature.                                                                                                        |

A component tagged FE1 can still have individual states or variants tagged SG or FE2+. Those are marked inline.

**FE1 routes** (the only ones that exist): `/`, `/help`, `/help/contributing`, `/help/faq-for-bards`, `/help/bard-preference-checklist`, `/help/conservation-status`, `/help/licence`, `/settings`, `/auth/login`, `/auth/callback`, `/auth/logout` (POST), `/resources/theme` (POST), `/api/me` (PATCH), `/api/tokens` (POST), `/api/tokens/:tokenId` (DELETE), `/styleguide` (not in production builds), and a catch-all 404. FE1 has **no** `/search`, `/contact` or `/login` route, no flash messages, no dismissible banners, no confirm routes, no `/` keyboard shortcut and no toast actions. Catalogue links and header search go to the original wiki through `app/constants/navigation.ts` (§5.3).

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
- Colour tokens are CSS custom properties holding **space-separated RGB channels** (for example, `--fg: 43 33 24`). Tailwind consumes them as `rgb(var(--fg) / <alpha-value>)`, so alpha modifiers work.
- `tokens.css` has three colour blocks, all generated from the same two maps:
  - `:root, [data-theme="light"]` holds the light values and `color-scheme: light`.
  - `:root[data-theme="dark"], [data-theme="dark"]` holds the dark values and `color-scheme: dark`.
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` holds the dark values and `color-scheme: dark`.
  - Because the blocks also match `[data-theme]` on any element, a wrapper can force a theme for its subtree (the styleguide previews do this). A `[data-theme="light"]` wrapper under an OS-dark page resolves to the light tokens, because the wrapper declares them itself.
- Components use semantic classes only, for example `bg-surface`, `text-fg-muted`, `border-border-strong`, `text-link` and `bg-accent`.
- **Tailwind's palette doesn't exist here.** `tailwind.config.ts` _replaces_ `theme.colors` (it doesn't extend it) with `{ transparent, current: "currentColor", inherit: "inherit", …tokens }`. So `bg-amber-600` and `text-white` don't compile to anything.
- **No arbitrary values** (`bg-[#fff]`, `text-[0.875em]`, `w-[min(…)]`). Every value a component needs is a named config value (Appendix A). If one is missing, add it to the config and to this document.
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

| Token (CSS var / Tailwind)                 | Light              | Dark               | Use                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--canvas` / `bg-canvas`                   | `#F7F2E8`          | `#16120E`          | Page background behind everything. Header and sidebar sit on canvas.                                                                                                                                                                                                   |
| `--surface` / `bg-surface`                 | `#FFFCF6`          | `#1D1814`          | Main content sheet (article column), cards.                                                                                                                                                                                                                            |
| `--surface-raised` / `bg-surface-raised`   | `#FFFFFF`          | `#27211B`          | Infobox, inputs, dialogs, drawer, menus, toasts.                                                                                                                                                                                                                       |
| `--surface-sunken` / `bg-surface-sunken`   | `#EFE7D8`          | `#110E0B`          | Chips, code, table header rows, skeletons, segmented-control track.                                                                                                                                                                                                    |
| `--border` / `border-border`               | `#E0D5C2`          | `#3A3129`          | Decorative hairlines: rules, card edges, dividers. **Not** for control boundaries.                                                                                                                                                                                     |
| `--border-strong` / `border-border-strong` | `#8A7A64`          | `#7D6E5C`          | Boundaries of interactive controls (inputs, checkboxes, secondary buttons): ≥3:1.                                                                                                                                                                                      |
| `--fg` / `text-fg`                         | `#2B2118`          | `#E4D9C6`          | Body text, headings.                                                                                                                                                                                                                                                   |
| `--fg-muted` / `text-fg-muted`             | `#55483A`          | `#C7BAA7`          | Secondary text, labels, inactive tabs, infobox labels.                                                                                                                                                                                                                 |
| `--fg-subtle` / `text-fg-subtle`           | `#6E6152`          | `#A69885`          | Meta text, captions, placeholders, external-link icons. Still ≥4.5:1 on every surface.                                                                                                                                                                                 |
| `--link` / `text-link`                     | `#1F4F8F`          | `#93B8EE`          | Unvisited links (lapis).                                                                                                                                                                                                                                               |
| `--link-visited` / `text-link-visited`     | `#6A3B80`          | `#C9A6E0`          | Visited links in prose only (murrey/purple).                                                                                                                                                                                                                           |
| `--link-hover` / `text-link-hover`         | `#153A6D`          | `#BBD3F6`          | Hover and active link colour (together with the underline change).                                                                                                                                                                                                     |
| `--accent` / `bg-accent`                   | `#A8470C`          | `#E9A440`          | Torch amber: primary button fill, current-tab bar, current-nav inset bar, infobox cap, logo flame outer, progress bar.                                                                                                                                                 |
| `--accent-hover` / `bg-accent-hover`       | `#8C3B0A`          | `#F4BA62`          | Primary button hover and active.                                                                                                                                                                                                                                       |
| `--accent-fg` / `text-accent-fg`           | `#FFFCF6`          | `#1F1407`          | Text and icons on `accent` fills.                                                                                                                                                                                                                                      |
| `--accent-text` / `text-accent-text`       | `#9A410B`          | `#EDB25A`          | Amber used _as text_: wordmark "Torch", current nav item, small highlights.                                                                                                                                                                                            |
| `--accent-subtle` / `bg-accent-subtle`     | `#FBEBD6`          | `#33240F`          | Tinted backgrounds: current nav item, chip hover, avatar initials.                                                                                                                                                                                                     |
| `--accent-glow` / `from-accent-glow`       | `#E8A33D`          | `#E9A440`          | **Decorative only.** Source colour of the hero glow. Never used for text or as the only boundary of anything.                                                                                                                                                          |
| `--hero-glow` / `bg-hero-glow`             | `#FBECD5`          | `#2D2318`          | **Derived**, not hand-picked: `accent-glow` composited over `surface` at 18 % (light) or 8 % (dark), computed in `tokens.ts`. It is the strongest point of the home hero's radial glow, which always sits on `surface`. Text on the hero is checked against it (§2.7). |
| `--focus` / `outline-focus`                | `#1F5FC4`          | `#8DB6FF`          | Focus ring. Blue, so it is distinct from amber selection and current-state marks.                                                                                                                                                                                      |
| `--selection` / `bg-selection`             | `#F5D9A6`          | `#5C4322`          | `::selection` background. Text stays `fg`.                                                                                                                                                                                                                             |
| `--scrim` / `bg-scrim`                     | `#2B2118`          | `#000000`          | Backdrop behind dialogs and the drawer, always used with an alpha (§4.4). The dark value is the only use of black, and it is never a surface.                                                                                                                          |
| `--input-bg` / `bg-input-bg`               | = `surface-raised` | = `surface-sunken` | Text-control background at rest. An alias, so inputs sit in a well in dark mode without a `dark:` class.                                                                                                                                                               |
| `--logo-core` / `fill-logo-core`           | `#E8A33D`          | `#F4BA62`          | **Decorative only.** Inner core of the logo flame (§5.9).                                                                                                                                                                                                              |

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

| Token                               | Light     | Dark      |
| ----------------------------------- | --------- | --------- |
| `--danger`                          | `#A3123A` | `#F28BA0` |
| `--danger-hover`                    | `#850E2F` | `#F7A9B9` |
| `--danger-on` (text on danger fill) | `#FFFFFF` | `#2A0A12` |

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
- Disabled controls use `text-fg-subtle` on `bg-surface-sunken` with `border-border`. WCAG exempts them from contrast, but they still pass.
- Opacity modifiers (`bg-accent/10`) are allowed for decoration only: hover washes behind text that is already compliant, or glows. **Never** put text on an opacity-modified background unless that pair has been tested.
- **The focus ring is never drawn inside an `accent` or `danger` fill.** Focus on `accent` is about 1.02:1 and on `danger` about 1.2:1, so an inset ring there would be invisible. Filled buttons always use the outset ring (§6.1). Anything inside a fill that must be focusable is redesigned instead, so that the current pagination item, for example, is a non-focusable `span`.

### 2.7 Contrast table (computed)

The ratios were computed with the WCAG 2.x relative-luminance formula:

- sRGB channels are linearised: c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4.
- L = 0.2126 R + 0.7152 G + 0.0722 B.
- ratio = (L1+0.05)/(L2+0.05).

`scripts/contrast.mjs` (`npm run check:contrast`, part of `validate`) reads **this table**. For each row it computes both ratios from `app/styles/tokens.ts`. It fails if a ratio is below the row's minimum, or if the printed ratio no longer matches the tokens, so the table can't go stale. It also checks the accent/danger hue gap (§2.4). **All 106 pairs pass in both themes.** Before you use a new pair, add a row (with any ratio) and run `npm run check:contrast`; it prints the real values to copy in.

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
| `info-icon` on `surface-sunken`      | 3:1   | 5.62:1  | 9.02:1  | SidebarNote icon                                            |
| `accent-text` on `surface-sunken`    | 3:1   | 5.45:1  | 10.18:1 | external nav arrow on hover                                 |
| `fg-muted` on `success-bg`           | 4.5:1 | 7.69:1  | 8.46:1  | ghost button in the token reveal                            |
| `border-strong` on `success-bg`      | 3:1   | 3.62:1  | 3.27:1  | token value box and Copy button edge in the reveal          |
| `border-strong` on `danger-bg`       | 3:1   | 3.54:1  | 3.41:1  | secondary button edge in a danger alert (Settings "Log in") |

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

**Implementation:** each size is a CSS variable (`--text-h1` and so on) in the generated `tokens.css`. It holds the mobile value, and an `@media (min-width: 768px)` block switches it to the desktop value. Each Tailwind `text-*` class sets the size, line height, letter-spacing and weight together, so `text-h1` is the whole style at every width, with no `md:` prefix. The family is a separate class (`font-display` or `font-sans`). Tailwind's default size scale (`text-sm`, `text-xl` …) is replaced and doesn't exist.

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
- **Vertical rhythm:** paragraphs have `margin-block: 0 1em`. Headings have `scroll-margin-top: calc(var(--header-h) + 0.5rem)`, so TOC and anchor jumps don't land under the sticky header (§6.1, WCAG 2.4.11). h2 has `margin-top: 2em; margin-bottom: 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid rgb(var(--border))` (this is the wiki rule, in warm hairline). h3 has `margin-top: 1.5em; margin-bottom: 0.4em`.
- **Links:** `text-link underline decoration-1 underline-offset-prose decoration-link/40` (`underline-offset-prose` = 0.2em).
  - On hover: `text-link-hover decoration-2 decoration-link-hover`.
  - Visited: `text-link-visited decoration-link-visited/40`.
  - External prose links get a trailing `IconExternalLink` at 0.85em, `text-fg-subtle`, `aria-hidden`, plus visually hidden "(external link)". The icon is wrapped with the last word in `white-space: nowrap` so it never orphans.
- **Lists:** `padding-left: 1.5em`.
  - `ul` markers are `fg-subtle`. Amber is kept for signals (§1.4), and help pages are mostly lists. `::marker` is the default disc, and nested lists use `circle`.
  - `ol` uses `decimal`, then `lower-alpha` for nested lists, with markers in `fg-muted`.
  - `li + li` has `margin-top: 0.25em`.
- **Blockquote:** `border-left: 3px solid rgb(var(--border-strong))`, `padding: 0.25em 0 0.25em 1em`, `color: fg-muted`, Fraunces 400 italic is **not** used (no italic face loaded). Use sans 1.0625rem with `font-style: normal`.
  - The attribution sits in a `<footer>` with `caption` styling, prefixed with "— ".
- The prose styles live in `app/styles/prose.css` as the `.prose-bt` component class. Markdown help content (FE1) is rendered inside it.
- **Tables:**
  - Full width of the measure, `border-collapse: collapse`, `body-sm`.
  - `th` has `bg-surface-sunken text-fg font-semibold text-left`, and cells have `padding: 0.5rem 0.75rem; border-bottom: 1px solid border`.
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

Use the Tailwind default 4 px scale only. **No arbitrary spacing values.** Sizes that aren't on the scale (header height, infobox and drawer widths, the textarea minimum and so on) are named config values, listed in Appendix A. Use these steps: `0.5` = 2 px, `1` = 4 px, `1.5` = 6 px, `2` = 8 px, `3` = 12 px, `4` = 16 px, `5` = 20 px, `6` = 24 px, `8` = 32 px, `10` = 40 px, `12` = 48 px, `16` = 64 px, `20` = 80 px, `24` = 96 px.

| Semantic use                             | Value                                                    |
| ---------------------------------------- | -------------------------------------------------------- |
| Icon–label gap in controls               | 2 (8 px), or 1.5 (6 px) in `sm` controls                 |
| Control internal padding x               | sm 3 (12 px), md 4 (16 px), lg 5 (20 px)                 |
| Stack gap between form fields            | 5 (20 px)                                                |
| Card padding                             | 4 (16 px) mobile, 5 (20 px) ≥md                          |
| Page gutter (horizontal)                 | 4 (16 px) <md, 6 (24 px) md, 8 (32 px) lg, 10 (40 px) xl |
| Section gap (between page sections)      | 10 (40 px) <md, 12 (48 px) ≥md                           |
| Gap between chips                        | 2 (8 px)                                                 |
| Header height (`--header-h`, `h-header`) | 56 px <md, 64 px ≥md                                     |
| Bottom app bar (`h-app-bar`)             | 56 px plus `env(safe-area-inset-bottom)`, <md only       |

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

Shadows are tokens, defined per theme in `tokens.ts` as `--shadow-1…3` (full `box-shadow` values, not channels) and exposed as `shadow-1`, `shadow-2` and `shadow-3` (plus `shadow-none`). They replace Tailwind's default shadows. The light shadows are tinted warm brown and the dark ones are mostly an inner highlight, so no `dark:` class is ever needed.

| Level | Used by                            | Light                                                                        | Dark                                                                                      |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0     | Page content, sidebar              | none                                                                         | none                                                                                      |
| 1     | Cards, infobox, header (on scroll) | `0 1px 2px rgb(60 40 20 / 0.06), 0 1px 3px rgb(60 40 20 / 0.08)`             | `inset 0 1px 0 rgb(255 236 210 / 0.04)` + surface step + `border`                         |
| 2     | Menus, popovers, toasts            | `0 4px 8px -2px rgb(60 40 20 / 0.10), 0 2px 4px -2px rgb(60 40 20 / 0.06)`   | `0 4px 12px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 236 210 / 0.05)` on `surface-raised` |
| 3     | Dialog, drawer                     | `0 16px 32px -8px rgb(60 40 20 / 0.20), 0 4px 8px -4px rgb(60 40 20 / 0.10)` | `0 16px 40px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 236 210 / 0.06)` on `surface-raised` |

- **Scrim** (behind dialogs and the drawer) is `rgb(var(--scrim) / 0.5)` in light and `/ 0.65` in dark. The alpha is the per-theme effect token `--scrim-alpha`, used as `backdrop:bg-scrim/scrim`, so no `dark:` class is needed.
  - `--scrim` is `#2B2118` in light and `#000000` in dark. The dark value is the only use of black, and it is never a surface.
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
- Height is `--header-h`: 56 px below `md` and 64 px from `md` up. `html` has `scroll-padding-top: calc(var(--header-h) + 0.5rem)`, so an element that receives focus by Tab or by an anchor jump is never hidden under the sticky header (WCAG 2.4.11).
- The first focusable element is a **skip link**, "Skip to content", which is visually hidden until focused and then appears as a primary `sm` button at top-left. Its padding is applied only on focus (`focus:px-3 focus:py-2`), so the hidden link stays a 1 px box rather than a padded 24 × 16 one.

**Below `md`, the header's controls move to a bottom app bar** (one-handed use). The top header then holds only the logo and wordmark, so nothing in it can overflow at 360 px. An e2e check asserts no horizontal overflow at 360 (and 320) px, signed out and signed in.

| Slot            | <md (360)                                                                                                                | md (768)                                                                                 | ≥lg (1280)                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Logo + wordmark | Top header, left. Mark 24 px + wordmark 20 px. A link to `/` whose accessible name is the wordmark text, "Bardic Torch". | Mark 28 px + wordmark 22 px, after the Menu button                                       | Same, left-aligned to the sidebar column                  |
| Menu            | **Bottom bar**, left cell                                                                                                | Top header, left: ghost icon button 44 × 44 (`IconMenu2`, label "Menu")                  | Hidden (sidebar persistent)                               |
| Search          | **Bottom bar**, middle cell                                                                                              | Inline SearchBox in the header, flexible, max 28rem                                      | Inline SearchBox, 28rem, starts at the main column        |
| Theme toggle    | **In the drawer**                                                                                                        | Header: visible label "Theme" + icon-only segmented control (3 × 36 px, `sr-only` names) | Header: visible label "Theme" + icon **and text** buttons |
| Account         | **Bottom bar**, right cell                                                                                               | Avatar 36 px in a 44 px hit area, or "Log in" secondary `sm`                             | Same                                                      |

**Bottom app bar** (<md only):

- It is part of the `<header>` landmark in the DOM (after the logo link), positioned `fixed inset-x-0 bottom-0`. So the Tab order at 360 px is skip link → logo → Menu → Search → Account → main content, and the bar needs no landmark of its own.
- Its height is `h-app-bar`: 56 px plus `padding-bottom: env(safe-area-inset-bottom)`. It is `bg-surface-raised border-t border-border shadow-2`, with three equal cells: **Menu · Search · Account**.
- Each cell is a full-height control (at least 44 × 56 px) with a 24 px icon above a visible `caption` label: "Menu" (`IconMenu2`), "Search" (`IconSearch`), and "Account" (avatar initials) or "Log in" (`IconLogin`). The visible label is the accessible name.
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

**Structure** (group heading `label-caps text-fg-subtle`, `mb-2`, `mt-6` except first; items `body-sm`):

```
BROWSE                                  ← group heading
  ⓘ The catalogue is on its way. Until it opens, these links go to the
    original Bardic Torch wiki.          ← SidebarNote (caption, fg-muted)
  Pieces ↗                               → https://bardictorch.miraheze.org/wiki/Category:Pieces
  Bards ↗                                → …/wiki/Category:Bards
  Collections ↗                          → …/wiki/Collections
FACETS
  Genre / kind ↗                         → …/wiki/Category:Genres
  Mood ↗                                 → …/wiki/Category:Moods
  Topic ↗                                → …/wiki/Category:Topics
  Culture ↗                              → …/wiki/Category:Cultures
  Language ↗                             → …/wiki/Category:Languages
  Legendaria ↗                           → …/wiki/Category:Legendaria
  Origin ↗                               → …/wiki/Category:Source_Category
  Conservation ↗                         → …/wiki/Category:Conservation_Status
HELP
  Contributing                           → /help/contributing
  FAQ for bards                          → /help/faq-for-bards
  Bard preference checklist              → /help/bard-preference-checklist
  Conservation status                    → /help/conservation-status
  Licence & attribution                  → /help/licence
CONTRIBUTE                               ← ContributeCard (see below)
```

- The URL map lives in one typed, read-only module, `app/constants/navigation.ts`. Each entry has `{label, href, external: boolean}`, so the catalogue launch (FE2) only flips `external` and `href`. The same module holds the header search target (`https://bardictorch.miraheze.org/w/index.php`, query parameter `search`) and the contact form (`https://forms.gle/wUwWnMKtWZSUisWCA`, until FE4). `bardictorch.miraheze.org` appears only in this module, the help content and the docs (a repo-hygiene test checks this). Every wiki target title must exist in `test/fixtures/wiki-categories.json`, a snapshot taken from the wiki dump.
- **Nav item:**
  - Layout: `flex items-center gap-2 min-h-11 (44px) <lg / min-h-9 (36px) ≥lg`, `px-3`, `rounded-md`, `text-fg-muted`. Focus ring inset (`-outline-offset-2`).
  - Hover: `bg-surface-sunken text-fg`.
  - Focus-visible: standard ring.
  - Current (`aria-current="page"`): `bg-accent-subtle text-accent-text font-semibold`, plus a 3 px `accent` bar on the left inset (`box-shadow: inset 3px 0 0 rgb(var(--accent))`).
  - On desktop the 36 px height is above the 24 px minimum, and spacing gives each item a 44 px pitch.
- **External nav item:**
  - Label, then `IconArrowUpRight` 14 px `text-fg-subtle`, pushed to the right with `ml-auto`, `aria-hidden`.
  - Then `<span class="sr-only"> (opens original wiki)</span>`.
  - It opens in the **same tab**. We don't force new windows, and the hidden text describes the destination, not the window.
  - On hover the arrow moves 2 px up-right (`motion-safe:transition-transform`, 120 ms; no movement under reduced motion) and turns `text-accent-text`.
- **SidebarNote:**
  - `flex gap-2 p-3 mb-2 rounded-lg bg-surface-sunken caption text-fg-muted`, with `IconInfoCircle` 16 px `text-info-icon`.
  - Text: "The catalogue is on its way. Until it opens, these links go to the original Bardic Torch wiki."
  - It is plain text, not a live region.
- **ContributeCard:**
  - `rounded-lg border border-border bg-surface p-4`.
  - The logo mark sits at 20 px, with the heading "Keep the torch lit" (`h4`) and the text "Anyone can add a piece, a link or a performance." (`body-sm text-fg-muted`).
  - A secondary `sm` full-width button, "Start contributing", goes to `/help/contributing`.

### 5.4 Main column

- `<main id="content" tabindex="-1">` is the skip-link target. It contains a **sheet**: `bg-surface border border-border rounded-xl shadow-1` at ≥lg. Below lg, the sheet is full-bleed with no border or radius, and `bg-surface` runs to the edges.
- Sheet padding: 16 px <md, 24 px md, 32 px lg, 40 px xl. It sits `mt-6 mb-10` at ≥lg.
- The **page head** has these parts, in order:
  1. Breadcrumbs (optional, caption).
  2. `h1`.
  3. Optional subtitle or meta line (`body-sm text-fg-muted`, for example "Song · 1994"; FE2+). Help pages have none: the breadcrumb already says "Help".
  4. The **tab row**, which sits on the title rule. The rule is the tab row's 1 px `border-border` bottom border, running the full sheet width. When a page has only one view (every FE1 page), the row holds a non-interactive "Read" label instead of tabs (§6.9).
  5. 24 px gap, then content.
- The right of the tab row holds page meta (`caption text-fg-subtle`, for example "Adapted from the original wiki ↗" on help pages, or "Last edited 3 Oct 2026" in FE2+). It wraps under the label below sm rather than hiding, because on help pages it is the only source link.
- Below the tab row, the order is: optional status banners (pending, stub, restricted; FE2+), then content (infobox first in source order), then category chips, then the licence meta line.

### 5.5 Infobox placement

- **≥md:** `float: right; width: 16.5rem` (264 px) at md–lg and `18rem` (288 px) at xl; `margin: 0 0 24px 32px`, `clear: right`.
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
- Links are separated by `·` (`aria-hidden`) inside a `ul` with inline items, and wrap freely at 360 px. Each link is `inline-flex min-h-6 items-center` (24 px), and the list has `gap-y-2` when it wraps, so the footer links meet WCAG 2.5.8 even though their text is `caption`.

### 5.8 Wireframes

These show a help page (`/help/conservation-status`), signed in. Signed out, the account slot reads "Log in".

**Desktop, 1280 × 800:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [skip] 🔥 Bardic Torch     [🔍 Search the original wiki…      ]  Theme [▣ System|☀ Light|☾ Dark] (JD ▾)│ 64
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ BROWSE               ┌───────────────────────────────────────────────────────────────────────┐ │
│ ┌ⓘ Catalogue on its ┐│ Help › Conservation status                                            │ │
│ │ way; links go to  ││ Conservation status                                     (h1 Fraunces) │ │
│ │ the original wiki.││                                                                       │ │
│ └───────────────────┘│ Read (label, not a tab)           Adapted from the original wiki ↗    │ │
│ Pieces            ↗ │ ───────────────────────────────────────────────────────────────────── │ │
│ Bards             ↗ │                                              ┌─ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ─┐ │ │
│ Collections       ↗ │ Conservation statuses help flag works that   │  At a glance (h2)     │ │ │
│ FACETS               │ may need more work to preserve them …        │  STATUSES (h3)        │ │ │
│ Genre / kind      ↗ │                                              │  Low risk             │ │ │
│ Mood              ↗ │ Contents                                     │  Endangered           │ │ │
│ Topic             ↗ │  1 Low risk  2 Endangered  3 …               │  Critically endangered│ │ │
│ Culture           ↗ │                                              │  Restricted           │ │ │
│ Language          ↗ │ Low risk                         (h2)        │  Not yet assessed     │ │ │
│ Legendaria        ↗ │ ───────────────────────────                  └───────────────────────┘ │ │
│ Origin            ↗ │ A work is low risk if it exists in at least four places …              │ │
│ Conservation      ↗ │  • Recordings on YouTube                                              │ │
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
│  Menu    │  Search   │  Account  │   each cell ≥ 44 × 56
└──────────┴───────────┴───────────┘
 gutter 16

Drawer (open, bottom sheet from the bar, max-height 85dvh):
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  scrim
┌──────────────────────────────────┐
│ ── (grab bar, decorative)        │
│ Site menu (h2)              (✕)  │ ← close button gets focus on open
│ [🔍 Search the original wiki… ]  │
│ BROWSE  ⓘ note                   │
│ Pieces                        ↗  │  items 44 px tall
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
- **Wordmark** (`app/components/Wordmark.tsx`, FE1): the mark plus the text "Bardic Torch" (§3.2). "Bardic" is `text-fg` and "Torch" is `text-accent-text`. The mark is `text-fg`, so its handle is ink. It renders inline, so the parent decides the semantics: a link to `/` in the header, or the h1 on the FE1 placeholder home page. Its mark is `h-6 w-6` below `md` and `h-7 w-7` from `md` up.
- **Handle:** a tapered shaft, `fill="currentColor"` (inherits `text-fg`): `M10.6 12.5h2.8l-0.75 9.25a0.9 0.9 0 0 1-0.9 0.75h-0.3a0.9 0.9 0 0 1-0.9-0.75z`.
- **Cresset (the bound head):** `fill="currentColor"`: `<rect x="8.75" y="10" width="6.5" height="2.75" rx="1.1"/>`, plus one binding ring on the shaft, `<rect x="10.1" y="15.25" width="3.8" height="1.1" rx="0.55"/>` (also currentColor).
- **Flame outer:** `class="fill-accent"`: `M12 1.25c2.9 2.6 4.6 4.75 4.6 6.75 0 1.3-0.95 2-2 2H9.4c-1.05 0-2-0.7-2-2 0-1.7 1.1-2.95 2.15-3.75 0.1 1.2 0.65 2.05 1.4 2.4C10.75 4.7 11.15 2.85 12 1.25z`.
- **Flame core:** `class="fill-logo-core"`: `M12.2 4.9c1.35 1.35 2.1 2.45 2.1 3.4 0 0.9-0.95 1.45-2.3 1.45s-2.2-0.6-2.2-1.35c0-0.8 0.55-1.4 1.15-1.7 0.2 0.7 0.6 1.1 1.1 1.2-0.3-1-0.25-2 0.15-3z`.
- `--logo-core` is a decorative token: `#E8A33D` (= accent-glow) in light, where it reads as a bright core inside the burnt-orange outer, and `#F4BA62` (= accent-hover) in dark, a hotter centre inside the bright amber outer.
- The outer flame meets ≥3:1 on every surface in both themes (rows `accent` on `canvas`/`surface`/`surface-raised`/`surface-sunken`).
- At 20 px the core may merge visually; that is fine, because the silhouette carries the mark.
- **Favicon:** `public/favicon.svg` is **generated** by `scripts/build-tokens.mjs` from the same paths and the `tokens.ts` values. Inside the SVG, a `<style>` with a `prefers-color-scheme: dark` block switches the handle between light and dark `fg`, the outer flame between light and dark `accent`, and the core between light and dark `logo-core`. No colour is typed by hand. `site.webmanifest` lists it as the icon (`sizes: "any"`). FE1 ships no raster icons (`favicon.ico`, `apple-touch-icon.png`), because generating them from tokens needs a rasteriser in the toolchain. They are FE2+ work, and browsers without SVG favicon support show their default icon until then.
- Check it on the styleguide at 20, 24, 28 and 32 px on all four surfaces in both themes before you commit.
- **Motion (FE1, header home link only):** on hover, the outer flame plays `flicker`: `scaleY 1 → 1.04 → 0.98 → 1` with `transform-origin: 50% 90%`, 600 ms, one iteration (`motion-safe:group-hover:animate-flicker`). It is disabled under reduced motion.

---

## 6. Components

Generic components live in `app/components/ui/`. App-specific ones (ThemeToggle, LogoMark, Wordmark, AccountMenu, SearchBox, TOC, HelpLinks and so on) live in `app/components/`. Each has a styleguide entry (§10.6) and a `*.test.tsx`. Unless a component says otherwise, the shared rules below apply.

| Component                              | Tag  | FE1 use                                                   |
| -------------------------------------- | ---- | --------------------------------------------------------- |
| Button (6.2)                           | FE1  | Everywhere                                                |
| Link (6.3)                             | FE1  | Everywhere                                                |
| Field, Input (6.4, 6.5)                | FE1  | Settings                                                  |
| Textarea, Select, Checkbox (6.6–6.8)   | SG   | None in FE1                                               |
| Tabs (6.9): Read label                 | FE1  | Every page head                                           |
| Tabs (6.9): page-link tabs and tablist | SG   | Styleguide (the tablist drives the theme preview)         |
| Infobox (6.10)                         | FE1  | Help pages ("At a glance")                                |
| Card (6.11)                            | FE1  | Home, help index                                          |
| Chip / TagList (6.12)                  | FE1  | Category chips, home facet chips                          |
| ConservationBadge (6.13)               | FE2+ | None. FE1 writes status names as text                     |
| Alert (6.14)                           | FE1  | Settings, home, noscript notice                           |
| Banner (6.14)                          | SG   | None in FE1 (page states are FE2+)                        |
| EmptyState (6.15)                      | FE1  | No API tokens                                             |
| ErrorState (6.16)                      | FE1  | 404, error boundaries                                     |
| Spinner (6.17)                         | FE1  | Button loading                                            |
| Skeleton (6.18)                        | SG   | None in FE1 (SSR pages render real content)               |
| Breadcrumbs (6.19)                     | FE1  | Help pages                                                |
| Pagination (6.20)                      | SG   | None in FE1                                               |
| Drawer (6.21)                          | FE1  | Navigation <lg                                            |
| Dialog (6.22)                          | FE1  | Revoke-token confirm                                      |
| Toast (6.23)                           | FE1  | Settings feedback                                         |
| ThemeToggle (6.24)                     | FE1  | Header from md; drawer (and the no-JS site menu) below md |
| AccountMenu (6.25)                     | FE1  | Header / bottom bar                                       |
| SearchBox (6.26)                       | FE1  | Header, drawer, home hero (searches the original wiki)    |
| TOC (6.27)                             | FE1  | Help pages with ≥4 h2s                                    |
| LogoMark, Wordmark (5.9)               | FE1  | Header, footer, EmptyState art                            |
| SidebarNote, ContributeCard (5.3)      | FE1  | Sidebar and drawer                                        |
| HelpLinks (5.7)                        | FE1  | Every footer and the root error page                      |
| Progress indicator (7.1)               | FE1  | Client navigations                                        |

### 6.1 Shared rules

- **Focus ring (all interactive elements):**
  - `outline: 2px solid rgb(var(--focus)); outline-offset: 2px`, applied on `:focus-visible` only. `app/styles/base.css` applies it to **every** `:focus-visible` element, so components get it without a class; they only adjust the offset (`focus-visible:-outline-offset-2` in dense containers).
  - The ring encloses the whole control: at least a 2 px perimeter at ≥3:1 against the adjacent surface (WCAG 2.4.11 and 2.4.13 friendly). Never set `outline: none` without this replacement.
  - Inside dense containers (tabs, chip rows, nav), use `outline-offset: -2px` so the ring can't be clipped. The inset ring sits on the item's own fill; every such pair is in §2.7. It is never inset on an `accent` or `danger` fill (§2.6).
  - In Windows forced-colours mode, outlines survive. `app/styles/base.css` also has `@media (forced-colors: active)` rules: buttons get `border: 1px solid ButtonText`, the current tab and current nav item (`[aria-current]`) get `outline: 2px solid Highlight`, `aria-pressed="true"` toggles get `outline: 2px solid Highlight`, and checkboxes go back to `appearance: auto` (§6.8). Decorative SVG fills (the logo) keep their colours with `forced-color-adjust: auto` defaults, because the mark is `aria-hidden` and the wordmark text carries the meaning.
- **Ids:** every `id` used by `aria-labelledby`, `aria-describedby`, `aria-controls` or `htmlFor` comes from React `useId()`. Never hard-code an id in a component: the styleguide renders many instances on one page, and duplicate ids break the references.
- **Focus not obscured (WCAG 2.4.11):** `html` has `scroll-padding-top: calc(var(--header-h) + 0.5rem)`, and below `md` also `scroll-padding-bottom` for the bottom app bar (§5.2). Scroll containers with a sticky footer (the drawer) set `scroll-padding-bottom` to that footer's height. Toasts never cover the control that triggered them (§6.23). The e2e helper `expectFocusNotObscured` tabs through every journey page and checks this.
- **Tap targets:**
  - Primary touch targets are ≥44 × 44 px below `lg`: header buttons, bottom-bar cells, nav items, buttons `md`/`lg`, tabs, pagination, drawer close, form controls.
  - Every other target meets WCAG 2.5.8: it is **either** at least 24 × 24 px, **or** a 24 px circle centred on it doesn't overlap any other target or its circle. Links inside running text are exempt. Small text links that aren't in a sentence (footer, breadcrumbs, TOC) are **not** exempt, so they get `inline-flex min-h-6 items-center` and `gap-y-2` when they wrap.
- **Hover** uses `@media (hover: hover)` only (Tailwind `hoverOnlyWhenSupported: true`), so touch devices don't get sticky hover.
- **Disabled:** use the native `disabled` attribute on buttons and inputs, with `cursor: not-allowed`. Prefer `aria-disabled="true"` plus a click guard when the control must stay focusable to explain _why_, for example a Save button with a tooltip-free help line.
- **No-JS first:** every action is a `<Form method="post">` or a link. JS adds optimistic UI, `useFetcher` and focus management. The one exception in FE1 is Settings (§10.3): its mutations need JS, and without JS a `<noscript>` Alert says so.
- **Motion:** every transform-based transition or animation class carries the `motion-safe:` variant (§8.3).
- **Icons** are `@tabler/icons-react`: `stroke={1.75}`, size 16 (sm/caption), 18 (body-sm), 20 (body), 24 (header). They are `aria-hidden` unless they are the only content, in which case the parent gets an accessible name.

### 6.2 Button

**Tag: FE1.**

- **Anatomy:** `[icon?] label [trailing icon?]`, with an optional spinner that replaces the leading icon.
- It is a `<button>` (`Button`), or a link styled the same when it navigates (`ButtonLink`: Remix `<Link>` for paths, a plain external anchor with the §6.3 marks for absolute URLs). Never use a `<div>`.

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

| Kind                                                | Style                                                                                                                                                                                                             | Notes                                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Internal, in prose                                  | §3.3 prose link (underlined, lapis, visited purple)                                                                                                                                                               | Remix `<Link prefetch="intent">`                                                                                          |
| Internal, standalone / UI (card titles, "View all") | `text-link font-medium`, no underline at rest, underline on hover and focus-visible                                                                                                                               | Only in navigational containers (§2.6)                                                                                    |
| External                                            | As above, plus trailing `IconExternalLink` 0.85em `text-fg-subtle` (`aria-hidden`) plus `<span class="sr-only"> (external link)</span>`. Or, for old-wiki links, `IconArrowUpRight` plus "(opens original wiki)". | `rel="noopener"`, no `target="_blank"` by default. User-supplied URLs also get `rel="nofollow ugc"` (FE2+; FE1 has none). |
| Muted                                               | `text-fg-muted underline decoration-fg-subtle/50`                                                                                                                                                                 | Footer, meta lines                                                                                                        |

- **States:** hover is `text-link-hover` with a 2 px decoration. Focus-visible is the shared ring with `rounded-sm` and `outline-offset: 2px`. Active (pressed) matches hover. There is no disabled link: render plain text instead.
- **Current page** links in body text (rare) get `aria-current="page"` and `font-semibold text-fg no-underline`.

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
  - Component: `ErrorSummary` (`app/components/ui/ErrorSummary.tsx`), given `problems: [{fieldId, message}]`, where `fieldId` is the `id` the parent passed to each `Field` (from its own `useId()`). It takes focus when it mounts and whenever the problems change, not on every re-render. Each link is `href="#{fieldId}"`; with JS a click also focuses the control (an in-page link alone only scrolls).
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
- **Disabled:** `bg-surface-sunken text-fg-subtle border-border`. **Read-only:** `bg-surface-sunken`, with the border kept.
- **Error:** a 2 px `danger-icon` edge, plus the message: the 1 px `border-danger-icon` plus an inset 1 px `ring-danger-icon` inside it, so neither the padding nor the content moves.
- **Loading** (FE2+, async check, e.g. duplicate name): a 16 px trailing Spinner inside, `aria-busy` on the field wrapper.
- Use `type` correctly (`email`, `url`, `search`) and set `autocomplete`. Never use placeholder as the label.
- Leading and trailing icon slots are 20 px with `pl-10`/`pr-10`. Icons are `text-fg-subtle`.

### 6.6 Textarea

**Tag: SG.** The counter is **FE2+**.

- Same as Input, with `min-h-textarea` (a named config value: 7.5rem, 120 px = 5 lines), `py-2.5`, `resize: vertical`, `leading-relaxed`.
- **Optional counter (FE2+):** `caption text-fg-subtle` right-aligned below. At ≥90 % of the limit it turns `text-warning-fg`, and over the limit `text-danger-fg` plus error. The counter is announced via `aria-describedby` and is not a live region. A polite "{n} characters left" is announced only at 20, 10 and 0.

### 6.7 Select

**Tag: SG.**

- Use a native `<select>` styled like Input: `appearance-none pr-10`, with an `IconChevronDown` 18 `text-fg-muted` absolutely positioned, `pointer-events-none`.
- No custom listbox in FE1. Options inherit the OS picker. Set `color-scheme` so the dropdown matches the theme.
- States are the same as Input.

### 6.8 Checkbox

**Tag: SG.**

- Use a native `<input type="checkbox">` with `appearance: none`: 20 × 20 px, `rounded-sm`, `border-2 border-border-strong`, `bg-surface-raised`.
  - **Checked:** `bg-accent border-accent`, with an `IconCheck` (stroke 3) in `accent-fg` laid over the box (`pointer-events-none`, shown by `peer-checked:`). An overlaid SVG rather than a CSS mask keeps the tick a token colour and needs no data URI.
  - **Indeterminate:** a horizontal bar (`IconMinus`, `peer-indeterminate:`).
- Wrapped in a `<label>` with the text, the whole row is the hit area: min height 44 px below lg, 32 px at ≥lg, with `gap-3`. Help text sits under the label text, indented to the text.
- **States:**
  - Hover: border `fg-subtle`.
  - Focus-visible: the ring around the box only.
  - Disabled: `bg-surface-sunken border-border`, check `fg-subtle`.
  - Error: border `danger-icon`, plus the field error message below the group.
- **Groups:** `<fieldset>` with `<legend>` styled as a field label.
- **Forced colours:** a token-drawn check is not reliable in Windows High Contrast, which would make checked and unchecked look the same. So the box carries `forced-colors:appearance-auto`, handing it back to the system control, and the overlaid marks carry `forced-colors:!hidden` (important, because `peer-checked:block` is more specific than a media-query utility). (A utility, not only the `base.css` rule: `appearance-none` is a utility, and the base layer can't override it.)

### 6.9 Tabs

**(a) Page tabs: Read / Edit / History** (**SG** in FE1; wired from FE2+). These are wiki navigation, so they are **links**, not a tablist.

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

- The row never wraps. It is **not** a scroll container: a scroller would clip the tabs' `-mb-px` overlap onto the title rule, and the three views (Read, Edit, History, with icons) fit in 320 px. The page meta at the right of the rule wraps under the tabs instead.
- Component: `ViewTabs` (`app/components/ui/Tabs.tsx`) renders the whole row, the rule included, with an optional `meta` slot; one view gives the a′ label, two or more the `nav`.

**(b) In-page tablist** (**SG**: the styleguide's theme preview uses it; no FE1 page does):

- `role="tablist"` with `aria-label`. Each `role="tab"` has `aria-selected`, `aria-controls` (ids from `useId()`), and roving `tabindex` (0 on the selected tab, −1 on the others). Each panel is `role="tabpanel"` with `tabindex="0"` and `aria-labelledby`.
- **Keyboard:** Left and Right move _and activate_ (automatic activation, because panels are cheap). Home and End jump. Tab moves into the panel.
- **Visual:** a segmented style to distinguish it from page tabs. The track is `bg-surface-sunken rounded-lg p-1`, each tab is `h-9 rounded-md body-sm`, and the selected tab is `bg-surface-raised text-fg shadow-1 border border-border`.
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
- **Style:** `bg-surface-raised border border-border rounded-lg shadow-1`, padding 16 px. The `dl` uses rows: `dt` is `body-sm text-fg-muted` and `dd` is `body-sm text-fg`, in a 2-column grid `7rem 1fr` (≥sm, inside the box). Rows have `py-2 border-b border-border`, and the last row has none.
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
- **Lists of cards** are a `<ul role="list">` with each card inside an `<li>` (`CardList`). Cards are never loose boxes without list semantics. ESLint's `jsx-a11y/no-redundant-roles` is configured to allow `role="list"` on `ul`/`ol` for this reason.
- **Whole-card link** (`link` variant): the title `<a>` gets `after:absolute after:inset-0`, and the card is `relative`. Secondary links inside get `relative z-10`. Hover gives `border-border-strong` and a title underline. Focus-visible puts the ring around the card by drawing it on the title link's `::after` (which already covers the card, `after:rounded-lg`), and the link's own outline is removed; `:has()` on the card would need an arbitrary variant. A link card has no other links inside.
- Cards don't nest.

### 6.12 Chip / TagList (category chips)

**Tag: FE1.** The current-chip state is **SG** (no FE1 term pages). Overflow is **FE2+**.

- The list is `<ul class="flex flex-wrap gap-2" role="list">`, and each item is a link chip.
- **Chip:**
  - `inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken text-link body-sm font-medium px-3`, with height 32 px (`sm`: 28 px, used in the infobox). Below lg, `md` chips have a 44 px hit area via padding (height 36) plus row gap 8.
  - The optional facet prefix sits in `text-fg-muted font-normal`, for example "Mood:" + "Singalong".
- **States:**
  - Hover: `bg-accent-subtle border-border-strong text-link-hover`.
  - Focus-visible: the ring.
  - Current (on its own term page): `aria-current="page"`, `bg-accent-subtle text-accent-text border-accent`. The focus ring is inset here, on `accent-subtle` (§2.7).
  - Disabled does not exist.
- **External chips** (FE1, pointing at the old wiki) get a trailing `IconArrowUpRight` 14 plus `sr-only` "(opens original wiki)".
- **Empty:** if a page has no categories, show `caption text-fg-subtle` "No categories yet." with an Edit link for editable pages (FE3).
- **Overflow (FE2+):** more than 12 chips collapse behind a "Show all {n}" ghost `sm` button (a disclosure: `aria-expanded`, `aria-controls`). Without JS, all chips are shown.

### 6.13 ConservationBadge

**Tag: FE2+** (PLAN §10 assigns it to FE2). The tokens (§2.5) and contrast rows exist already. FE1 pages name statuses in text: the conservation help page uses headings, and the home card links to that page.

- **Anatomy:** a pill, `[icon] Label`, with `bg-cons-{s}-bg text-cons-{s}-fg border border-cons-{s}-border rounded-full`. The icon is in `text-cons-{s}-border`. See §2.5 for the per-status values; critically endangered gets a 2 px border, and unassessed gets a dashed border.
- **Sizes:** `sm` is 24 px high, `px-2 caption gap-1`, icon 14. `md` is 28 px, `px-2.5 body-sm font-medium gap-1.5`, icon 16.
- **Semantics:**
  - Static by default: `<span>`, with the visible text as the label.
  - When it is a link to `/help/conservation-status#{status}`, the accessible name is "Conservation status: Endangered".
  - Also add `sr-only` "Conservation status: " before the label wherever the context doesn't already say so (outside the infobox row labelled "Conservation").
- **States:** hover (link variant only) adds an underline on the label. Focus-visible is the ring. There are no other states.
- **Restricted** never appears alongside "help preserve this" prompts. The page template suppresses them (R-7).
- **Dark:** tints over charcoal. The icon colour is lighter and less saturated, and text is near-vellum.

### 6.14 Alert / Banner

**Tag:** Alert **FE1**. Banner **SG**. There is no dismissible variant (FE2+; see below).

- **Anatomy:** `[icon 20] [title (body 600)] [body (body-sm)] [actions]`. It is `flex gap-3 p-4 rounded-lg border bg-{s}-bg border-{s}-border text-{s}-fg`, the icon is `text-{s}-icon`, and links inside use `text-{s}-fg underline`.
- **Variants:** see the table below.
- **Placement:** an _Alert_ is inline in content. A _Banner_ is full sheet width under the tab row (page-level states: pending, stub, restricted; all FE2+). It uses the same component with `variant="banner"`: `rounded-none border-x-0` on mobile, `rounded-lg` at ≥md.
- **Semantics:**
  - Static alerts rendered with the page are **not** live regions: a plain `<div>` with an `<h2 class="sr-only">` or a visible title.
  - Alerts injected after an action use `role="status"` (info, success, pending) or `role="alert"` (danger, and warning when blocking). Mount the container empty first, so the announcement fires.
- **No dismissible variant in FE1.** No FE1 alert needs dismissing, and dismissal without JS would need a route and a cookie the plan doesn't have. If a later milestone adds one, it must add the route, the cookie (with its flags tested) and the no-JS form to the plan first. **Danger and pending alerts are never dismissible.**
- Links inside alerts use `text-{s}-fg underline`, and their focus ring sits on `{s}-bg` (pairs in §2.7).
- **Components** (`app/components/ui/Alert.tsx`): `Alert` (`tone`, optional `title`, body, `actions`, `banner`, `icon`, `headingLevel`) and `AlertRegion` (an always-mounted `role="status"`, or `role="alert"` with `urgent`). Every tone has a distinct icon and a hidden tone name ("Warning: ") before the words.

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
- **Semantics:** a plain `<section aria-labelledby>` (id from `useId()`). It is not live. (FE2+: when it replaces search results, the results-count status region announces "No results".)
- **Components:** `EmptyState` (`title`, body, `action`, `headingLevel` 3 by default) and its art `UnlitMark` (`app/components/LogoMark.tsx`): the handle and cresset `fill-current text-fg-subtle`, the flame `stroke-border-strong` with `vector-effect: non-scaling-stroke`, so the outline is exactly 1.5 px at every size.

### 6.16 ErrorState

**Tag: FE1.**

- **Inline / section** (a region failed to load): Alert danger, with a short title, the cause if known, and "Try again" (secondary `sm`, which revalidates via `useRevalidator`, or a reload link without JS).
- **Page:** see §10.5. The illustration is the unlit torch (as above) with the outer flame dashed. The title is h1. When Sentry is configured, it includes a reference in `caption font-mono text-fg-subtle`, "Reference: 7f3a…": the Sentry `eventId` returned by `captureRemixErrorBoundaryError`. Without Sentry, the reference line is omitted. (The boundary can't read response headers, so there is no request id to show.) Actions: "Go to the home page" and "Try again".
- Never show a stack trace, raw status text or JSON.
- **Components** (`app/components/ui/ErrorState.tsx`):
  - `TryAgain` (`variant`, `size`): with JS a Button that calls `useRevalidator().revalidate()` and is `loading` while the loaders run (a successful revalidation also clears an error boundary). In the server render and before hydration it is a `ButtonLink reloadDocument` to the current path and query, so it works without JS.
  - `SectionError` (`title`, cause): the inline form, a danger Alert with a `sm` TryAgain.
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
- **Shimmer:** a 1.6 s linear gradient sweep, `linear-gradient(90deg, transparent, rgb(var(--surface-raised) / var(--shimmer-alpha)), transparent)`, where `--shimmer-alpha` is a token (0.6 light, 0.35 dark). It runs only under `motion-safe:`; under reduced motion it is static.
- **Semantics:** the region wrapper has `aria-busy="true"`, and one `sr-only` "Loading {thing}…". Skeleton blocks are `aria-hidden`.
- It must reserve the **exact** final dimensions (no CLS on swap). Skeletons exist only for client transitions. SSR pages render real content.

### 6.19 Breadcrumbs

**Tag: FE1.** The collapse is **FE2+** (FE1 crumbs are two deep).

- `<nav aria-label="Breadcrumb"><ol>` containing links, with the last item `<span aria-current="page">` in `text-fg-muted`, not a link. The separator is `IconChevronRight` 14 `text-fg-subtle aria-hidden`, an inline SVG after each ancestor link (CSS `::before` can't draw a token-coloured Tabler icon without a data URI). Text is caption, links are `text-link` with no underline (underline on hover), and each link is `inline-flex min-h-6 items-center` (§6.1, WCAG 2.5.8).
- Component: `Breadcrumbs` (`trail: [{label, to}, …]`, `current`), `ol role="list"` with `flex-wrap gap-y-2`.
- **At 360 px (FE2+):** collapse the middle items to "…" (a disclosure button, `aria-label="Show full path"`) when there are more than 3. Without JS, it wraps instead.
- Shown on help pages ("Help › …") and later on term pages. Not shown on Home.

### 6.20 Pagination

**Tag: SG.**

- `<nav aria-label="Pagination">` containing: "Previous" (`IconChevronLeft` + text), page numbers, and "Next". These are links with `?page=n`.
- **Items:** `min-w-11 h-11 rounded-md body-sm` (44 px). The current page is `aria-current="page"`, `bg-accent text-accent-fg font-semibold`, and is a `span`, not a link, so it never takes focus (an inset ring on `accent` would be invisible, §2.6). Hover is `bg-surface-sunken`.
- **Ellipsis:** `…` in `text-fg-subtle aria-hidden`, with a hidden "more pages".
- **<sm:** only "Previous", "Page 3 of 12" (body-sm, fg-muted) and "Next". Prev and Next become 44 px icon buttons with visible text kept at ≥360 px.
- **Disabled prev/next** (first or last page): render a `<span aria-disabled="true">` in the disabled style, not a link.
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
  - **Sticky bottom:** the ThemeToggle with its visible label "Theme", and a secondary full-width "Close menu" button, in the thumb zone. The scrolling part has `scroll-padding-bottom` equal to this bar's height, so a nav item reached by Tab is never hidden behind it (WCAG 2.4.11).
- **Behaviour:**
  - The menu button has `aria-haspopup="dialog"` and `aria-controls`. It has no `aria-expanded`: once the modal is open, the trigger is inert and can't be read anyway.
  - **On open, focus goes to the close button**, which has `autoFocus`. That is predictable, and screen-reader users hear the dialog's name first. Native `showModal()` would otherwise focus the first focusable element, so the `autoFocus` is what makes this explicit.
  - On close (Escape, either close button, backdrop click, or navigation), focus returns to the menu button.
  - Body scroll is locked (`overflow: hidden` on `html`) while it is open.
  - It closes automatically on route change, and when the viewport reaches `lg`.
- **Motion:** the bottom sheet slides up from `translateY(100%)` and the side drawer from `translateX(-100%)`, over 240 ms with `--ease-out`. The scrim fades over 180 ms. Movement is `motion-safe:` only; under reduced motion it fades, 120 ms. **Closing is instant in FE1** (no exit animation): a native `<dialog>` leaves the top layer as soon as `close()` runs, and delaying that to animate would delay the focus return as well.
- **No-JS:** the menu button is `<a href="#site-nav">`. The fallback navigation renders **after `</main>` and before `<footer>`**, not inside main, so it doesn't pollute the skip-link target. It is the same single `<nav aria-label="Site" id="site-nav">` that the persistent sidebar uses at ≥lg (one element, placed by CSS), headed by the SearchBox and an h2 "Site menu", so there is never a second Site landmark. With JS, that fallback copy below lg is `hidden`, and the button becomes a `<button>`.
- **Component:** `Drawer` (`app/components/ui/Drawer.tsx`; `open`, `onClose`, `title`, `closeLabel` "Close menu", body, `footer`, `closeFrom="lg"`), built on `useModalDialog` (shared with Dialog).
  - The dialog is a flex column: grab bar (<md, decorative `bg-border-strong`), title row, a scrolling body (`min-h-0 flex-1 overflow-y-auto`) and the footer. The footer sits **outside** the scroller rather than over it, so nothing in the body can scroll under it and no `scroll-padding-bottom` is needed.
  - The bottom sheet's padding is `pb-safe-b` (`env(safe-area-inset-bottom)`, a named padding value).
  - Focus goes to the close button through a ref after `showModal()`. React's `autoFocus` calls `focus()` during commit, before the dialog is shown, and doesn't render the attribute that native dialog focusing reads.
  - It closes on any navigation (`useLocation().key` changes) and, with `closeFrom="lg"`, when `(min-width: 1024px)` starts to match; C5's nav drawer passes it.

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
- **Motion:** fades in and scales from 0.98 to 1 over 180 ms `--ease-out` (`motion-safe:` only). Under reduced motion it fades only. Closing is instant, as for the Drawer.
- **Component:** `Dialog` (`app/components/ui/Dialog.tsx`; `open`, `onClose`, `title`, `description`, body, `confirm: {label, icon, variant: primary|danger, onConfirm | form}`, `cancelLabel`, `pending`, `initialFocus`, `fallbackFocus`). A `danger` confirm makes it destructive, so the backdrop doesn't close it. With `form`, the confirm is a submit button for that form id.
- **Shared behaviour** (`useModalDialog`): `open` drives `showModal()`/`close()`; Escape (`cancel`, prevented and handled), the backdrop and a browser-initiated close all call `onClose`. A backdrop click must start and end on the `<dialog>` itself, so a text selection dragged out of the content doesn't close it. `html` gets `overflow-hidden` while open. The backdrop is `backdrop:bg-scrim/scrim`, which needs `::backdrop` to inherit custom properties (Chromium 122+, Firefox 120+, Safari 17.4+).

### 6.23 Toast

**Tag: FE1** (Settings feedback). Toasts carry **no actions** in FE1.

- **Region:** rendered once in `root.tsx`, **empty at SSR**: `<section aria-label="Notifications" class="fixed z-toast …">` containing two live regions:
  - `<div role="status" aria-live="polite" aria-atomic="false">` for success and info
  - `<div role="alert" aria-live="assertive">` for errors that need immediate attention
- **Placement:**
  - **Below sm: at the top**, under the header (`top: calc(var(--header-h) + 8px)`, width `calc(100vw - 32px)`). At the bottom they would cover the bottom app bar and the controls near the thumb, often the very button that triggered them (WCAG 2.4.11).
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
- **JS enhancement:** the form's submit is intercepted and the choice saved with a plain `fetch` (no `returnTo`; `sendForm` in `app/client/send-form.ts`), not a Remix fetcher: the toggle lives in the root's shell, and Remix throws a fetcher's failed request (a 503 the app didn't make, no network) to the owning route's boundary, which for the root would replace the whole site. The choice is applied **optimistically**: the pressed state and `<html data-theme>` (both read from `ThemeChoiceContext`, which the root `Layout` provides) update immediately, before the response; the root loader doesn't run again. On any failure, including a response the app didn't make and no network, it reverts and shows an inline error under the control (role `alert`): "Couldn't save your theme. Try again." With no network, the offline toast (§7.3) appears too. The inline message keeps the error next to the control that caused it.
- **Visual:**
  - The label is `caption font-medium text-fg-muted`.
  - The track is `bg-surface-sunken rounded-full p-0.5 border border-border`.
  - Header buttons are 36 × 32 px with icon 18. At md they are icon-only with `sr-only` names. At ≥lg they show their text too. There is **no tooltip**, so WCAG 1.4.13 doesn't apply.
  - Drawer buttons are 44 px tall, flexible width, and show visible text labels.
  - Pressed: `bg-surface-raised text-fg shadow-1 border border-border-strong`. Unpressed: `text-fg-muted` with a transparent border, hover `text-fg`. Focus-visible: the ring.
- **One toggle per page.** It lives in the header at ≥md and in the drawer below md. Settings has **no** Appearance section, so two toggles never appear together.
- **Keyboard:** Tab moves between the three (they are plain buttons, which suits a submit form). Space and Enter activate.

### 6.25 AccountMenu

**Tag: FE1.** "My contributions" is **FE2+**.

- **Signed out:** a "Log in" control linking to `/auth/login?returnTo={current path}`: the bottom-bar cell below md (§5.2), a secondary `sm` button at md+.
- **Signed in:** a **disclosure navigation**, not an ARIA `menu`.
  - **Trigger:** `<button aria-expanded aria-controls={panelId}>`, showing the avatar (initials on `bg-accent-subtle text-accent-text`, Fraunces 600, 32 px circle), plus `IconChevronDown` 14 at md+. The accessible name is "Account: {display name}".
  - **Panel:** `w-64 bg-surface-raised border border-border rounded-lg shadow-2 p-2`. At md+ it is right-aligned under the header. Below md it opens **upwards**, above the bottom bar, right-aligned to the Account cell. Its contents:
    - a header showing the display name (body 600) and the role (caption fg-muted: "Contributor" / "Moderator")
    - links: "Settings" (`/settings`) and, in FE2+, "My contributions"
    - a separator
    - "Log out", a `<Form method="post" action="/auth/logout">` button styled as a menu row
  - Rows are `h-10 px-3 rounded-md body-sm` (44 px below lg), with hover `bg-surface-sunken`.
- **Profile failed to load** (the root loader's `/v1/me` call failed): the trigger reads "Account" with generic initials, and the panel shows a `warning` inline message, "We couldn't load your profile. [Try again]", above the Settings and Log out rows. Pages still render.
- **Keyboard:** Enter or Space toggles. Escape closes and returns focus to the trigger. Tab moves through the links. Focus leaving the panel, or clicking outside, closes it.
- **No-JS:** `<details><summary>` with the same panel.
- **Built as (FE1):** `app/components/AccountMenu.tsx` uses `<details>` with JS too, rather than swapping to a `<button aria-expanded>` after hydration: the summary is a native disclosure (its expanded state is exposed by the browser), so there is one markup and no hydration swap. JS adds the closing rules through `useDismiss` (Escape returns focus to the summary; a press or focus outside, or a navigation, closes it). The trigger's accessible name comes from `sr-only` text ("Account: {name}"; the bar cell's visible "Account" starts it), not `aria-label`. The root loader's account states are `signed-out`, `signed-in`, `profile-unavailable` and `blocked` (`app/constants/account.ts`); a blocked account's panel shows the danger message and "Log out" only.

### 6.26 SearchBox

**Tag: FE1.** In FE1 it searches **the original wiki**.

- **Markup:** `<form role="search" method="get" action="https://bardictorch.miraheze.org/w/index.php">` (target and parameter name from `app/constants/navigation.ts`), with `<label for={inputId} class="sr-only">Search the original wiki</label>` and `<input type="search" id={inputId} name="search" autocomplete="off" enterkeyhint="search">`. The placeholder is "Search the original wiki…". The form is marked external like any wiki link: an `IconArrowUpRight` next to the submit button, with `sr-only` "(opens original wiki)" in its label.
- **Visual:** Input styling at `h-10` (40 px, header md+) or `h-11` (drawer, search sheet and home hero), `rounded-full`, with a leading `IconSearch` 18 `fg-subtle`. The submit button is a trailing ghost icon button (`IconArrowRight`, "Search the original wiki"), always present so the form works without Enter.
- **Bottom-bar Search cell (<md):** see §5.2. It opens the search sheet above the bar.
- **States:** focus shows the ring. There are no suggestions and no loading state; the wiki owns its results page.
- **No keyboard shortcut.** A single-key `/` shortcut would break WCAG 2.1.4 (it fires for speech-input users too), and none is provided.
- **FE2:** the action becomes the catalogue's own search route, `name` becomes `q`, and the empty and no-results states in §7.2 and §11.3 apply.

### 6.27 Table of contents (help pages)

**Tag: FE1** (inline). The sticky right rail, the current-section highlight and the heading "§" anchors are **FE2+**.

- Shown when a page has **≥4 h2s**. It is `<nav aria-labelledby={titleId}>`, with the title "Contents" in `label-caps`. Items are an `<ol>` of h2s and h3s, each with its number (e.g. "2.1") in `text-fg-subtle tabular-nums`. Each item link is `inline-flex min-h-6 items-center` (WCAG 2.5.8).
- **<xl, and in FE1 at every width:** inline after the intro paragraph, as `<details open>` on md+ and `<details>` (closed) on mobile, with `bg-surface-sunken rounded-lg p-4`.
- **≥xl with no infobox (FE2+):** sticky in the right rail (`top: calc(var(--header-h) + 24px)`, width 14rem). The current section is highlighted with an IntersectionObserver: `aria-current="true"`, `text-accent-text font-semibold` and an inset left bar. With no JS, there is no highlight.
- **Built as (FE1):** `TableOfContents({ entries: [{ id, label, children? }] })`. It server-renders `<details open>` (so it is open without JS) and folds itself after hydration below md. `WikiPage` shows it after `intro` when `contents` has four or more entries.
- Headings get `id`s (and `scroll-margin-top`, §3.3). FE2+ adds a hover "§" anchor link, 24 × 24 px, `aria-label="Link to this section"`.

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
- **No search results (FE2+):** see §11.3. FE1 has no search page: search goes to the original wiki.
- **No categories (FE1):** the inline caption (§6.12).

### 7.3 Errors: inline vs page

- **Inline** (field-level, FE1): the field pattern (§6.4). The error summary is SG.
- **Region-level** (part of a page failed, FE1): an ErrorState inline Alert. The rest of the page stays usable. Example: the root loader's profile call fails, and the account panel shows its warning (§6.25) while every page still renders.
- **Page-level** (loader threw, 404, 500; FE1): the Remix `ErrorBoundary` renders the error page template (§10.5) _inside the app shell_, so header and nav still work. The `<title>` is "Page not found · Bardic Torch" or "Something went wrong · Bardic Torch". Focus moves to the h1 on client-side errors. The 503 "resting" variant is FE2+.
- **Network / offline** (fetch failure on a client action, FE1): a danger toast, "You seem to be offline. Your changes haven't been saved yet.", plus the inline error in the affected form. Form values are kept.
- **A response the app didn't make** (a platform 503, a gateway's 502 or HTML error page, FE1): the inline error in the affected form, the form's "We couldn't … Check your connection and try again." Form values are kept. A mutation never ends in an error boundary: the settings forms submit to the settings route's `clientAction`, and the theme toggle saves with `fetch`; both read every outcome as a proxy body (`sendForm`).

### 7.4 Success

- **FE1 (Settings, JS only):** after a settings form's fetcher (through the settings route's `clientAction` to the `/api/*` proxy) succeeds, the changed value is updated on the page and a success toast confirms it ("Display name saved."). After a token is created, the one-time reveal Alert appears in place (§10.3).
- **FE2+ (no-JS forms):** after a POST-redirect-GET, a success Alert at the top of the affected section.
- Focus stays where it was, or moves to the Alert if the form disappeared.
- Copy is in the past tense and specific: "Display name saved." Don't write "Success!".

### 7.5 Pending approval (banner wording pattern)

**Tag: FE3** (editing). The wording is fixed here so the Banner component can be built and shown in the styleguide (SG).

Every edit from a non-moderator waits for John or Fabian. This is a normal step and is written warmly. The banner is the `pending` variant, non-dismissible, placed directly under the tab row.

- **To the author, on the page they edited:**
  > **Your edit is waiting for approval.** You saved changes to _{Page title}_ on {d MMM yyyy}. Until a moderator reviews them, everyone else sees the last approved version. [View your version] · [Why do edits wait?]
- **To other readers, when a pending version exists:**
  > **A newer version is waiting for approval.** You're reading the last approved version. [See what changed] _(moderators only; others see no link)_
- **To moderators:**
  > **1 pending edit by {name}.** [Review it]
- **After submit (toast and success Alert):** "Thanks! Your edit has been sent for approval."

The pattern is: **what state it is in** (bold, ≤7 words), then **what it means for you**, then **one or two actions**. Never use the words "rejected", "blocked" or "error" for pending.

**Related page-level banners** (FE2+; FE1 shows them in the styleguide only):

- **Stub** (info): "**This page is a stub.** We know this piece or person exists but haven't gathered much yet. [Help complete it]".
- **Restricted** (info variant, icon swapped for `IconLock`): "**The creator has asked that this work isn't recorded or shared.** Please respect their wishes. [Read their statement ↗]". This replaces every "help preserve" prompt.
- **Prefers no page** (info): "**{Name} has asked not to have a page here.** This stub keeps their request on record so the page isn't recreated. [Read their statement ↗]".

---

## 8. Motion

### 8.1 Tokens (CSS vars from `tokens.ts`, also in Tailwind `transitionDuration` / `transitionTimingFunction`)

| Token             | Tailwind           | Value                        | Use                                                |
| ----------------- | ------------------ | ---------------------------- | -------------------------------------------------- |
| `--dur-instant`   | `duration-instant` | 80 ms                        | Colour and background changes on hover             |
| `--dur-fast`      | `duration-fast`    | 120 ms                       | Focus/press feedback, link arrow nudge, toast exit |
| `--dur-base`      | `duration-base`    | 180 ms                       | Dialog, menu and toast enter, scrim fade           |
| `--dur-slow`      | `duration-slow`    | 240 ms                       | Drawer slide, disclosure height                    |
| `--dur-flicker`   | `duration-flicker` | 600 ms                       | Logo flame (one-shot)                              |
| `--ease-standard` | `ease-standard`    | `cubic-bezier(0.2, 0, 0, 1)` | Default                                            |
| `--ease-out`      | `ease-out`         | `cubic-bezier(0, 0, 0.2, 1)` | Entering                                           |
| `--ease-in`       | `ease-in`          | `cubic-bezier(0.4, 0, 1, 1)` | Leaving                                            |

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

### 10.1 Home (`/`)

**Tag: FE1.** There are no tabs and no Read label. The sheet has no title rule: the hero replaces the page head.

```
┌ sheet (bg-surface) ──────────────────────────────────────────────┐
│  [hero panel: radial glow accent-glow → transparent, over        │
│   surface only; rounded-xl]                                      │
│   🔥 (48px mark)                                                  │
│   Find the songs, stories and poems of the bardic community.     │ display (h1)
│   Bardic Torch is a community-kept index of SCA bardic pieces    │ body-lg fg-muted, ≤60ch
│   and the bards who made them — so they can be found, sung and   │
│   passed on.                                                     │
│   [How to contribute] (primary lg)  [Browse on the original      │
│                                      wiki ↗] (secondary lg)      │
│   [🔍 Search the original wiki…            ] (SearchBox h-11)     │
├──────────────────────────────────────────────────────────────────┤
│  Why Bardic Torch                                    (h2 + rule)  │
│  ┌ An index, not ┐ ┌ Links only ───┐ ┌ Keep works ───┐            │ 3 static Cards in a
│  │ an archive    │ │ We never host │ │ alive         │            │ ul role=list (1 col <md,
│  │ We make       │ │ lyrics, audio │ │ Some works …  │            │ 2+1 md, 3 col ≥lg)
│  │ existing …    │ │ or video …    │ │ [statuses →]  │            │
│  └───────────────┘ └───────────────┘ └───────────────┘            │
│  Start exploring on the original wiki                (h2)        │
│  TagList md: (Songs ↗)(Poems ↗)(Stories ↗)(Singalong ↗)(Warlike ↗)│
│  (Norse ↗)(Arthuriana ↗) …   + every facet in the nav            │
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
  - Lead: "Bardic Torch helps bards find music, lyrics, history, context and etiquette, and helps audiences find that song they loved around the campfire but forgot the title of. We gather the bardic community's scattered songbooks, playlists and album pages into one index, so works can be found, sung and passed on." (The judged home copy, `content-drafts/home.md`; longer than the first sketch, still ≤ 60ch per line.)
  - Catalogue note under the buttons (`body-sm fg-muted`): "The catalogue is moving here soon. Until it opens, you can browse every piece and bard on the original Bardic Torch wiki."
- **Calls to action.** The primary action stays on this site: **"How to contribute"** (primary `lg`, to `/help/contributing`). The catalogue isn't here yet, so the honest secondary action is **"Browse on the original wiki ↗"** (secondary `lg`, external, with `sr-only` "(opens original wiki)" after the visible label, so the visible label starts the accessible name, WCAG 2.5.3).
- **Why cards** (`static` Card variant, §6.11), from the judged home copy. The "links only" message is the end of card 1, creator's wishes included:
  1. **An index, not an archive**: "Bardic works are spread across many songbooks, playlists and album pages. We don't replace them. We link to them and make them findable by mood, topic, culture, origin and more. We never host lyrics, recordings or video: every piece points to where it already lives, and to its creator's wishes about sharing."
  2. **Every version, everywhere**: "We link to each version of the words and each performance, wherever it lives online or in print. Some works exist in only one or two places. When you find an endangered piece, add a link or host a copy, and help pass the torch." It ends with a text link, "How conservation statuses work", to `/help/conservation-status`. (ConservationBadge examples are FE2+.)
  3. **Anyone can contribute**: "You don't have to be a bard, and no contribution is too small. Log in, add what you know, and a moderator will review it before it goes live. That way the index can keep growing beyond what any one person could maintain." It ends with a text link, "How to contribute".
- **For bards:** the paragraph from the home copy, then two secondary buttons, "FAQ for bards" and "Bard preference checklist", then the non-affiliation info Alert.
- **Built as (FE1):** `app/routes/_index.tsx`. The hero panel is `rounded-xl bg-hero` (the radial glow, Appendix A). Each section is a `<section>` labelled by its h2 (with the rule). The chips are the sidebar's facets (`FACETS` in `navigation.ts`).
- **Facet chips** come **after** the Why cards, under a heading that says where they go ("Start exploring on the original wiki"). Every chip is an external old-wiki chip (§6.12).
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
- **Optional infobox "At a glance":** a 3–6 row `dl` summarising the page. For example, Conservation status lists the five statuses, each a link to its section. The Bard preference checklist shows "What it is / Who it's for / Time needed".
- **TOC** when there are ≥4 h2s (§6.27).
- Prose in `.prose-bt`.
- **Template (FE1):** `WikiPage` (`app/components/WikiPage.tsx`): `title`, `breadcrumbs?` (Breadcrumbs props), `meta?` (the tab row's right end), `infobox?`, `intro?`, `contents?` (TOC entries), `categories?` (TagList tags; the chip row is `<nav>` labelled by its "Categories" h2), `licence?` (the footer meta line) and the prose as children. The Read label's `to` is the current path.
- Category chips at the bottom (e.g. "Help", "Conservation"). In FE1 these are internal links to `/help`, or external to the old wiki category ↗.
- **Footer meta line** (caption fg-subtle): "This page is available under CC BY-SA 4.0. Adapted from 'Conservation Status' on the original Bardic Torch wiki by its contributors."
- **Content pages in FE1:** `contributing`, `faq-for-bards`, `bard-preference-checklist`, `conservation-status`, `licence`, plus an index at `/help`. The index is a `ul role="list"` of `link` Cards.
- Help pages are **Markdown** (`.md`, compiled by `@mdx-js/rollup` with `format: "md"`), with `:::note`, `:::warning` and `:::infobox` directives that map to Alert and Infobox. They are reviewed for tone (§11) and adapted rather than copied verbatim. Remove the wiki's mobile warning and "make an account on Miraheze" instructions.
- **Built as (FE1):** the pages live in `app/content/help/*.md`; the pipeline is `app/content/markdown/` (options, plugins and the component map).
  - Front matter: `title`, `description` (≤160 characters, the meta description), `summary` (`og:description`; the index's intro), `sourcePages` (wiki page titles, credited in the meta link and the licence line) and `lastReviewed` (`YYYY-MM-DD`, shown in the licence line). The build fails on front matter that doesn't match `helpFrontmatterSchema`.
  - `:::infobox{title="At a glance"}` holds one list of `**Label:** value` or `[Label](#section): value` items, which become the Infobox's rows. `:::cards` (the index only) holds one list of `[Title](/help/slug): description` items, which become link Cards. A note or warning with one paragraph renders it as the Alert's body. Any other directive, a missing infobox title or a stray `:name` text directive fails the build.
  - h2s and h3s get GitHub-style ids from their text (`#how-restricted-works`), and the module exports them as the contents. The infobox is rendered first and outside `.prose-bt`; the content before the first h2 is the intro; the TOC follows it.
  - Links: absolute URLs are external `Link`s (wiki URLs get the wiki mark and suffix); paths go through Remix. Links in the infobox are standalone, in the prose they are prose links.

### 10.3 Settings (`/settings`, signed-in only)

**Tag: FE1.** Its mutations need JS: without JS, a `<noscript>` warning Alert says "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it." Until the page has hydrated (and so always without JS) the buttons that submit or open the revoke dialog are disabled; the notice says why. Signed out, the page shows a prompt with a "Log in" button to `/auth/login?returnTo=/settings`. A blocked account sees only the blocked danger Alert. If the root's `/v1/me` failed, the Profile section is a SectionError ("We couldn't load your profile.", Try again) and the tokens still load. If `GET /v1/tokens` fails (500, unreachable, malformed), the route's own error boundary replaces the page content inside the shell ("We couldn't load your settings", Try again, home); a 403 from it is a danger Alert in the tokens section. A session the API ended mid-visit (a 401 from a settings form) clears the session and runs the root loader again, so the header and the page show the signed-out state with "Log in" back to Settings. The document and the loader's `?_data` answers are `Cache-Control: no-store` (so is the root's `?_data` answer while signed in).

The head is the h1 "Settings" with no tab row. Sections are separated by h2 plus rule. The page is single column, `max-w-form` (42rem).

1. **Profile**:
   - Field "Display name". Help: "Shown on your edits and in page history. Use your SCA name if you like." The rule is the API's: the value is NFC-normalised and trimmed, then it must be **1–64 characters** (Unicode code points) with **no control or invisible formatting characters** (Unicode Cc/Cf); the server takes at most 256 characters before normalising. The limits and the hint copy (`DISPLAY_NAME_RULE`, "Use 1 to 64 characters, without control or invisible formatting characters.") come from `app/schemas/rules.ts` (`displayNameProblem`), shared by the zod schema, the proxy route and this page; that module has no zod, so the browser checks with the same function without loading it.
   - [Save changes] (primary).
   - **Success:** a toast "Display name saved.", and the new name shows in the field and the account menu.
   - **Errors:** inline field errors "Enter a display name." / "Display names can be up to 64 characters." / "Display names can't contain control or invisible formatting characters." (checked in the browser and by the proxy). An upstream 400 `invalid_request` becomes the inline error with the `DISPLAY_NAME_RULE` copy; the API's own `message` is never shown (it is not meant for end users). A 403 `user_blocked` shows the danger Alert "Your account is blocked, so you can't make changes. Contact the Bardic Torch team if you think this is a mistake." Any other failure, including a response the app didn't make (a platform 503) and no network (with the offline toast, §7.3), shows the danger Alert "We couldn't save your changes. Check your connection and try again.", and the typed name stays. A 401 means the session ended: the root loader runs again, so the header and the page show the signed-out state with "Log in".
   - There is no "Signed in with" row: neither the API (`Me` is `{id, display_name, role}`) nor the session knows the provider.
2. **API tokens**:
   - Intro (body-sm fg-muted): "Tokens let tools, such as an MCP client, read and suggest edits on your behalf. Treat them like a password."
   - **List** (≥md, a table; <md, a `ul role="list"` of Cards): Name · Prefix (the API's `prefix` field, `font-mono`, followed by "…") · Created · Last used ("Never") · [Revoke] (secondary-danger `sm`, `aria-label="Revoke token {name}"`).
     - A token with no name is shown as **"Token {prefix}…"**, both visibly and in the `aria-label`.
     - The API lists **active tokens only, newest first**, and tokens have no expiry or revoked state, so there are no "Expired" or "Revoked" badges and nothing to hide.
     - A user has at most **10 active tokens** (`ACTIVE_TOKEN_LIMIT`).
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
     │ [I've copied it] (ghost) — dismisses and clears from the DOM  │
     └──────────────────────────────────────────────────────────────┘
     ```
     - The token is shown in a `readonly` two-row textarea (so the 73-character value wraps at 360 px; `.wrap-anywhere`) with `aria-label="New token value"`. Focus moves to it, with the value selected. If the clipboard refuses, a visible line says so and the value is selected again for copying by hand. "I've copied it" moves focus to the "API tokens" h2.
     - Copy uses `navigator.clipboard`. On success it swaps the icon to `IconCheck` with the text "Copied", and a polite status announces "Token copied".
     - The proxy response sets `Cache-Control: no-store`.
   - **Revoke:** the confirm Dialog (§6.22 copy). On success, the row is removed, a toast says "Token revoked.", and focus goes to the "API tokens" h2. A 404 `not_found` (already gone) shows "That token no longer exists. Reload the page to see your current tokens."
3. **No Appearance section.** The theme is set from the header or drawer toggle, which already says "Theme", so there is one toggle per page.

### 10.4 404 (`*` and loader 404s)

**Tag: FE1.**

- **h1:** "We couldn't find that page".
- **Body:** "It may have moved, or the link may be mistyped. Bardic Torch is new, so pages from the old wiki don't redirect here yet."
- **Actions:** [Go to the home page] (primary) and the link "Look on the original wiki ↗". The link goes to `https://bardictorch.miraheze.org/w/index.php?search={last path segment}` (URL-encoded, built from `navigation.ts`). There is no internal Search button: FE1 has no search page.
- **Illustration:** the unlit torch (EmptyState art), at 64 px.
- It returns HTTP 404 and has no tab row. The footer HelpLinks are present, as on every page.
- **Built as (FE1):** `app/routes/$.tsx` (loader status 404) renders `NotFound` (`app/components/ErrorPages.tsx`) inside the shell. A 404 thrown by any loader reaches the root error boundary, which shows the same body on the standalone page (§10.5). The wiki search term is the last path segment, decoded, with `_` and `-` read as spaces.

### 10.5 Error page (500 / unexpected)

**Tag: FE1.** The 503 variant is **FE2+**.

- **h1:** "Something went wrong".
- **Body:** "That's on us, not you. Try again in a moment. If it keeps happening, let us know and include the reference below." (Without Sentry there is no reference, so the last clause is dropped.)
- The reference is the Sentry `eventId` in mono (§6.16). Actions: [Try again] (reload, primary) and [Go to the home page]. "Let us know" is the HelpLinks Contact link, not a separate one.
- **503 (API down, FE2+):** h1 "Bardic Torch is resting", body "We're doing some upkeep or the catalogue is briefly unreachable. Please try again in a few minutes."
- **Built as (FE1):** `ServerError` in `app/components/ErrorPages.tsx`. The root `ErrorBoundary` reports the error with `captureRemixErrorBoundaryError` after mounting and shows the returned event id only when `Sentry.isInitialized()`; 404s are not reported.
- It is rendered within the shell. If the shell itself can't render (the root boundary), it uses a minimal standalone page with the same tokens and stylesheet, the Wordmark, and the **same HelpLinks block** (Contact · Help · Licence & attribution) as every other page (WCAG 3.2.6).

### 10.6 Styleguide (`/styleguide`, not linked from nav, `noindex`)

**Tag: SG** (exists in development, preview and e2e builds; excluded from production builds).

- Its sections follow this document: Colour (swatches showing name, hex for both themes and the contrast ratio, read from `tokens.ts`), Type scale, Spacing, Radii and elevation, Logo at 20/24/28/32 on all surfaces, then every §6 component with every state in a grid, including the SG and FE1-only states.
- A page-level in-page tablist, "Preview: Current / Light / Dark / Side by side", forces a `data-theme` on a wrapper.
  - This works because the token blocks also match `[data-theme]` on any element (§2.1). An e2e assertion checks that a forced-light panel under an OS-dark page has a computed `--canvas` equal to the light value from `tokens.ts`.
  - Side-by-side renders both themes in two columns at ≥xl.
- Each component block has an anchor (`/styleguide#button`), which the screenshot checkpoints target one by one.
- **How it is built** (`app/routes/styleguide.tsx`, blocks in `app/styleguide/`):
  - `Gallery` renders the blocks in `SPECIMENS` order. Each block is a `Specimen` (a section named by its h2, with a one-line summary and its DESIGN section) holding `Example`s, one per state or variant, each captioned.
  - The preview tablist is the in-page `Tabs` (§6.9 b). It is `lazy`: only the selected panel renders its gallery, so the page holds one copy (two in Side by side) instead of five. The panels are Current (no wrapper, so it follows the page theme), Light and Dark (a `data-theme` wrapper on `bg-canvas`), and Side by side (both wrappers in `xl:grid-cols-2`). Each forced copy prefixes its anchors (`light-button`, `both-dark-button`, …), so the two Side by side copies never share an id; the unprefixed anchors are in Current, and they are the ones the checkpoints and `/styleguide#button` use. Without JS only Current is shown.
  - Colour swatches come from `COLOURS` in `tokens.ts`: the name, the resolved value in each theme and its contrast with `canvas` in each theme. The fill classes are written out in a `Record<ColourName, string>`, so a new token is a type error until it has a swatch.
  - ErrorState's page headings are h1s on a real page, so the styleguide shows them inside a framed example; the page's own h1 is "Styleguide".
  - The route sets `robots: noindex, nofollow`. `vite.config.ts` adds `**/styleguide*` to `ignoredRouteFiles` in production mode only, and `check:prod-build` fails unless `routes/styleguide` is absent from the production server build and client manifest and present in preview.
  - `test/component-usage.test.ts` fails if anything exported from `app/components/` is imported only by tests. Components that no FE1 page uses yet (the SG ones) are used here.
- **e2e** (`e2e/stub/styleguide.spec.ts`, the e2e build): one checkpoint per block (`checkpoint(page, id, { target: "section#id" })` scopes axe and the screenshot to the block), plus `dialog-open` and `drawer-open`. It also covers the real focus trap, Escape, the backdrop rules and focus return for Dialog and Drawer, the Drawer's placement below and above md, toast placement and timing, the forced-light/forced-dark preview, Windows forced colours (`emulateMedia({ forcedColors: "active" })`: button edges, checkbox `appearance: auto` with the drawn marks hidden, outlines on current, pressed and selected, the focus ring) and the WCAG 1.4.12 text-spacing override (nothing clipped, no horizontal overflow at 360 and 320 px).

---

## 11. Voice and microcopy

### 11.1 Voice

- **Friendly and plain.** Write like a helpful herald at a bardic circle: warm and clear, never cute, never legalese. Mild heritage flavour is welcome in headings and empty states, for example "Keep the torch lit". Avoid it in errors, buttons and labels.
- **Use British/International English spelling.** "Licence" is the noun and "license" the verb; also "colour", "organisation", "catalogue", "favourite", "centre".
- **Sentence case** everywhere: "Create token", "FAQ for bards", "Licence & attribution". Proper nouns keep their capitals (Bardic Torch, SCA, Creative Commons). Never use Title Case or ALL CAPS in source text. The `label-caps` style is CSS-only, and screen readers read the sentence-case source.
- **Address the reader as "you" and the project as "we".**
- **Buttons start with a verb** and say what will happen: "Save changes", "Revoke token". Don't use "OK", "Submit" or "Yes".
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

| Where                    | Title                   | Body                                                                             | Action             |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------- | ------------------ |
| API tokens               | "No tokens yet"         | "Create a token to let tools like an MCP client work with Bardic Torch for you." | Create token       |
| No search results (FE2)  | "Nothing matches '{q}'" | "Try a shorter search, or browse by mood or topic."                              | Browse pieces      |
| No categories            | —                       | "No categories yet."                                                             | Edit (if editable) |
| Stub with no links (FE2) | "No links yet"          | "Know where this piece lives online or in print? Add the first link."            | Add a link         |

### 11.4 Fixed strings

- Non-affiliation: "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
- Licence on edit forms (FE3): "By saving, you agree to release your contribution under CC BY-SA 4.0."
- External old-wiki link suffix (screen readers): "(opens original wiki)". Other external links: "(external link)".
- Settings without JS: "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it."
- Theme toggle group label: "Theme". Options: "System", "Light", "Dark".
- Sidebar note: "The catalogue is on its way. Until it opens, these links go to the original Bardic Torch wiki."

---

## Appendix A: Tailwind config

`tailwind.config.ts` takes every value from `app/styles/tokens.ts`; it has no literals of its own. Keys under `theme` (not `extend`) **replace** Tailwind's defaults, so the default palette, size scale, radii, shadows, durations and animations don't exist. The default spacing scale and breakpoints are kept.

| Theme key                  | Replaced or extended | Classes                                                                                                                                                                                                                                                                                                |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `colors`                   | replaced             | `transparent`, `current`, `inherit`, plus every token in §2.3–2.5: `bg-canvas`, `text-fg-muted`, `border-border-strong`, `outline-focus`, `fill-accent`, `bg-info-bg`, `text-cons-low-fg` … Each maps to `rgb(var(--name) / <alpha-value>)`.                                                           |
| `fontFamily`               | replaced             | `font-display`, `font-sans`, `font-mono`                                                                                                                                                                                                                                                               |
| `fontSize`                 | replaced             | `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-label-caps` (always used with `uppercase`), `text-code`, `text-wordmark`. Each sets size (a CSS variable that changes at `md`), line height, letter-spacing and weight. |
| `borderRadius`             | replaced             | `rounded-none`, `rounded-sm` (4 px), `rounded-md` (6 px), `rounded-lg` (10 px), `rounded-xl` (16 px), `rounded-full`                                                                                                                                                                                   |
| `borderWidth`              | replaced             | `border` (1 px), `border-0`, `border-2`, `border-3`                                                                                                                                                                                                                                                    |
| `boxShadow`                | replaced             | `shadow-none`, `shadow-1`, `shadow-2`, `shadow-3` (`var(--shadow-n)`), `shadow-current-bar` (the current nav item's inset 3 px `accent` bar, §5.3)                                                                                                                                                     |
| `transitionDuration`       | replaced             | `duration-instant`, `duration-fast`, `duration-base`, `duration-slow`, `duration-flicker` (default: instant)                                                                                                                                                                                           |
| `transitionTimingFunction` | replaced             | `ease-standard`, `ease-out`, `ease-in` (default: standard)                                                                                                                                                                                                                                             |
| `keyframes`, `animation`   | replaced             | `animate-spin`, `animate-pulse-soft`, `animate-shimmer`, `animate-progress`, `animate-flicker`, `animate-fade-in` (120 ms, the reduced-motion entrance), `animate-dialog-in`, `animate-toast-in` (180 ms), `animate-sheet-in`, `animate-drawer-in` (240 ms)                                            |
| `spacing`                  | extended             | `13` (3.25rem, 52 px): `min-h-13`, `w-13` for `lg` buttons                                                                                                                                                                                                                                             |
| `maxHeight`                | extended             | `max-h-sheet` (85dvh, the bottom-sheet drawer), `max-h-below-header` (`calc(100dvh - var(--header-h))`, the sticky sidebar)                                                                                                                                                                            |
| `inset`                    | extended             | `top-toast` (`calc(var(--header-h) + 0.5rem)`, toasts below sm), `top-header` (`var(--header-h)`, the sticky sidebar), `bottom-above-app-bar` (`calc(var(--app-bar-h) + env(safe-area-inset-bottom) + 1rem)`, toasts from sm to md)                                                                    |
| `gridTemplateColumns`      | extended             | `grid-cols-infobox` (`7rem 1fr`, infobox rows), `grid-cols-shell` (`15rem minmax(0, 1fr)`, sidebar and main at lg), `grid-cols-shell-xl` (`16rem minmax(0, 1fr)`)                                                                                                                                      |
| `opacity`                  | extended             | `/shimmer` (`var(--shimmer-alpha)`) and `/scrim` (`var(--scrim-alpha)`) as colour modifiers: `via-surface-raised/shimmer`, `backdrop:bg-scrim/scrim`. Both alphas are per-theme effect tokens.                                                                                                         |
| `maxWidth`                 | extended             | `max-w-prose` (68ch), `max-w-form` (42rem), `max-w-shell` (90rem)                                                                                                                                                                                                                                      |
| `height`                   | extended             | `h-header` (`var(--header-h)`), `h-app-bar` (3.5rem), `h-text-line` (0.75em), `h-progress` (3 px, the navigation progress bar)                                                                                                                                                                         |
| `minHeight`                | extended             | `min-h-textarea` (7.5rem)                                                                                                                                                                                                                                                                              |
| `width`                    | extended             | `w-dialog` (`min(32rem, calc(100vw - 2rem))`), `w-drawer` (`min(20rem, 85vw)`), `w-infobox` (16.5rem), `w-infobox-xl` (18rem)                                                                                                                                                                          |
| `textUnderlineOffset`      | extended             | `underline-offset-prose` (0.2em)                                                                                                                                                                                                                                                                       |
| `backgroundImage`          | extended             | `bg-hero`: the home hero's radial glow, `hero-glow` at the top left fading to transparent over `surface` (§10.1)                                                                                                                                                                                       |
| `padding`                  | extended             | `pb-safe-b` (`env(safe-area-inset-bottom, 0px)`, bottom sheets), `pb-app-bar` (`calc(var(--app-bar-h) + env(safe-area-inset-bottom, 0px))`, room for the bottom app bar under the page below md)                                                                                                       |
| `transformOrigin`          | extended             | `origin-flame` (`50% 90%`, the logo flicker; with the `.transform-box-fill` utility in `base.css` so it is measured on the flame, not the viewBox)                                                                                                                                                     |
| `zIndex`                   | extended             | `z-header` (30), `z-progress` (40), `z-toast` (50)                                                                                                                                                                                                                                                     |

Other config: `future.hoverOnlyWhenSupported: true` (hover styles only for devices that can hover). `darkMode` is left at Tailwind's default and the `dark:` variant is never used (§2.1; `test/no-raw-colours.test.ts` rejects it).

In this config, the colour named `border` gives `border-border`. That is intended and is the documented class.

**Where the styles live:**

- `app/styles/tokens.ts`: the token source (hand-written).
- `app/styles/tokens.css`: generated custom properties (colours per theme, shadows, type sizes, motion, layout).
- `app/styles/fonts.css`: the Fraunces `@font-face` rules and the metric-matched fallback faces.
- `app/styles/base.css`: element defaults (`html`, `body`, `::selection`, headings), `scroll-padding`, the global `:focus-visible` ring, the `.opsz-32` utility (wordmark), the `.transform-box-fill` utility (logo flicker), the `.wrap-anywhere` utility (`overflow-wrap: anywhere`, for token names and secrets on Settings), `scroll-padding-bottom` below md (bottom app bar), forced-colours rules and the smooth-scroll rule (inside `prefers-reduced-motion: no-preference`).
- `app/styles/prose.css`: the `.prose-bt` component class (§3.3).
- `app/styles/app.css`: the entry. It `@import`s the files above, then the Tailwind layers. `root.tsx` links it with `links()` as a render-blocking stylesheet.

## Appendix B: Token CSS shape

This is the shape of `app/styles/tokens.css` as `scripts/build-tokens.mjs` writes it from `app/styles/tokens.ts`. Colour values are channel triplets, so alpha modifiers work.

```css
/* @generated by scripts/build-tokens.mjs from app/styles/tokens.ts — do not edit. Run `npm run gen:tokens`. */
:root,
[data-theme="light"] {
  color-scheme: light;
  --canvas: 247 242 232; /* #F7F2E8 */
  --fg: 43 33 24; /* #2B2118 */
  --accent: 168 71 12; /* #A8470C */
  /* …every colour token in §2.3–2.5… */
  --input-bg: var(--surface-raised);
  --shadow-1: 0 1px 2px rgb(60 40 20 / 0.06), 0 1px 3px rgb(60 40 20 / 0.08);
  --shimmer-alpha: 0.6;
}
:root[data-theme="dark"],
[data-theme="dark"] {
  color-scheme: dark;
  --canvas: 22 18 14; /* #16120E */
  --fg: 228 217 198; /* #E4D9C6 */
  --accent: 233 164 64; /* #E9A440 */
  /* … */
  --input-bg: var(--surface-sunken);
  --shadow-1: inset 0 1px 0 rgb(255 236 210 / 0.04);
  --shimmer-alpha: 0.35;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* the same declarations as the dark block, generated from the same map */
  }
}
:root {
  --header-h: 3.5rem;
  --text-h1: 1.875rem;
  --dur-fast: 120ms;
  /* …type sizes, motion, layout… */
}
@media (min-width: 768px) {
  :root {
    --header-h: 4rem;
    --text-h1: 2.25rem;
    /* … */
  }
}
```

`base.css` then sets `html { background: rgb(var(--canvas)); color: rgb(var(--fg)); }` and `::selection { background: rgb(var(--selection)); color: rgb(var(--fg)); }`.
