# Bardic Torch design system

The reference for the frontend's visual and interaction decisions (`bardic-torch-fe`: React Router 8, Tailwind 4, Cloudflare Workers). The code is the spec for components and page layouts; this document holds the principles and the values the code and its checks rely on. Where it gives a value, use that value. If something you need isn't covered, add it here in the same PR as the code.

**The brief:** _looks like a wiki, but modern and lovely._ People should recognise the wiki layout straight away: a page title with a rule under it, Read / Edit / History tabs, a left nav, a right infobox and category chips at the bottom. The finish is warm and crafted: firelight, vellum, iron-gall ink and lapis, used with restraint. Light and dark are both first-class designs.

---

## 1. Principles

1. **An index, not an archive.** Bardic Torch points to where works live and never hosts them. _So we_ style outbound links as the main content (link lists, "where to find it" sections). They are never buried, and every external link is marked as external.
2. **Editing is allowed, and it looks that way.** _So we_ show the Edit tab on every editable page, even to signed-out readers (it leads to sign-in and then back), and we write the pending-approval state as a normal step rather than as a warning.
3. **Familiar wiki layout, contemporary finish.** _So we_ keep the wiki's layout (title and rule, tabs, left nav, infobox, categories) but use generous spacing, soft radii, a warm palette and a single serif display face. We never copy MediaWiki chrome: no blue-grey gradients and no boxy tab outlines.
4. **The torch lights the way and doesn't set the page on fire.** Amber is the accent. _So we_ keep it for the logo, the primary action, the current tab and current nav item, focus-adjacent marks and the infobox cap, and we keep it to less than about 5 % of any screen. List bullets, blockquote rules and `hr` ornaments are **not** amber (§3.3). Body text is always ink on vellum, or vellum on charcoal.
5. **Legible first, beautiful second, and both together.** _So we_ use system sans for body and UI text, measure prose at about 68 characters, make every text pair at least 4.5:1 and every meaningful non-text element at least 3:1, and never convey state by colour alone (every status has an icon and a word).
6. **Dark is its own design.** _So we_ design dark mode as warm charcoal lit by firelight. It is never an inversion. Saturation is reduced, elevation comes from lighter surfaces rather than shadows, and every component is screenshot-reviewed in both themes.
7. **Works for everyone, everywhere.** It must work from 360 px wide, work without JavaScript, and respect reduced motion. _So we_ build every control as a real link or form first, enhance it with JS second, and make primary touch targets 44 × 44 px.

---

## 2. Colour

### 2.1 Mechanism

- **`app/styles/tokens.ts` is the source of truth for colour**: every colour for both themes, and the only TypeScript file with colour literals.
- **`app/styles/tokens.css` is hand-written** and holds the CSS custom properties, the type scale, radii, shadows, motion and layout sizes, and the Tailwind `@theme` block. `app/styles/tokens.test.ts` fails if its colours, or those in `app/styles/theme-colour.ts` (the `<meta name="theme-color">` values), disagree with `tokens.ts`. `public/favicon.svg` and `public/site.webmanifest` repeat `canvas` by hand.
- Colour tokens are CSS custom properties holding **space-separated RGB channels** (`--bt-fg: 43 33 24`), under a `--bt-` prefix so they don't clash with Tailwind's own variables. The theme reads them as `rgb(var(--bt-fg))`. A colour at an alpha is a named utility that writes `rgb(var(--bt-fg) / 0.1)`.
- `tokens.css` has three colour blocks: `:root, [data-theme="light"]`, `:root[data-theme="dark"], [data-theme="dark"]`, and the dark values again under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`. The server renders `data-theme` from the `theme` cookie, so there is no flash.
- Components use semantic classes: `bg-surface`, `text-fg-muted`, `border-border-strong`, `text-link`, `bg-accent`.
- **Tailwind's palette doesn't exist here.** The `@theme` block starts with `--*: initial`, so `bg-amber-600` and `text-white` compile to nothing.
- **No arbitrary values** (`bg-[#fff]`, `w-[min(…)]`) and **no `dark:`**: `dark:` would follow the OS and ignore the user's explicit choice. A missing value is a named token or `@utility` in `tokens.css`. ESLint rejects both, and `test/no-raw-colours.test.ts` fails on any colour literal outside `tokens.ts` and the files that mirror it.

### 2.2 How the palettes are built

- **Light ("vellum"):** warm off-white parchment (`canvas`), lighter vellum panels (`surface`), warm near-black ink (`fg`, never pure black). Links are **lapis** blue; the accent is **torch amber**, a burnt orange dark enough to carry white text.
- **Dark ("firelit hall"):** never an inversion.
  1. Warm charcoal canvas, never black. `#000` appears only as the scrim.
  2. Elevation is lighter: canvas → surface → raised. Wells (code, chips, inputs at rest) go darker.
  3. Hues are desaturated and lightened, keeping their light-mode hue angle. Status backgrounds are 8–12 % tints.
  4. Text is vellum, not white (`fg` about 13:1), which reduces halation.
  5. Amber becomes a light fill with _dark_ text (`accent-fg`), like a lit lamp.
  6. Shadows mostly disappear: depth is a surface step, a 1 px `border` and a faint inner highlight (§4.4).

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

Each family has `--{s}-bg`, `--{s}-border`, `--{s}-fg` and `--{s}-icon` (`bg-info-bg`, `border-info-border`, `text-info-fg`, `text-info-icon`). `border` is decorative (an alert is identified by its icon and words); `icon` meets ≥3:1 on `{s}-bg` and `surface`; `fg` meets ≥4.5:1 on both.

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

Danger is crimson, not red-orange, so a danger fill never looks like the amber primary. `accent` and `danger` (and their hover fills) differ by **at least 30° of hue** in both themes. Hue isn't enough on its own, so a danger button also carries an icon and a verb.

### 2.5 Conservation-status tokens

Used by `ConservationBadge` and the conservation key on the help page: `--cons-{s}-bg`, `--cons-{s}-fg` and `--cons-{s}-border` (the border token also colours the icon, ≥3:1 on the badge and on `surface`). Status is never shown by colour alone: there is an icon, the label, and a different border style or weight at the extremes.

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

- Text goes only on `canvas`, `surface`, `surface-raised`, `surface-sunken`, `accent-subtle`, `hero-glow`, a status `-bg`, or its own fill (`accent`, `danger`). Use only these backgrounds for text; a new pair must reach 4.5:1 (3:1 for non-text) in both themes.
- In prose, links are distinguished by an underline as well as colour (WCAG 1.4.1). Outside prose, a link may drop the underline only inside a clearly navigational container: nav lists, tabs, chips, breadcrumbs, cards whose whole area is the link. It must still show an underline on hover or focus.
- Use `link-visited` in prose and search results only, not in nav, tabs or chips.
- Disabled controls use `text-fg-subtle` on `bg-input-bg-locked` with `border-border` (the checkbox box keeps `border-border-strong`, so an empty disabled box stays visible on dark `surface`). Disabled Pagination steps have no fill at all. WCAG exempts them from contrast, but they still pass.
- Opacity modifiers (`bg-accent/10`) are allowed for decoration only: hover washes behind text that is already compliant, or glows. **Never** put text on an opacity-modified background unless that pair has been tested.
- **The focus ring is never drawn inside an `accent` or `danger` fill.** Focus on `accent` is about 1.02:1 and on `danger` about 1.2:1, so an inset ring there would be invisible. Filled buttons always use the outset ring (§6.1). Anything inside a fill that must be focusable is redesigned instead, so that the current pagination item, for example, is a non-focusable `span`.

### 2.7 Contrast

The tokens were chosen for contrast: WCAG 2.2 AA in both themes (4.5:1 for text, 3:1 for non-text UI).

- **Where the focus ring sits.** The default ring has a 2 px offset, so it sits on the surface around the control. In dense containers (tabs, chip rows, nav) it is inset (`outline-offset: -2px`), so it sits on the item's own fill: `accent-subtle`, a status `-bg` or `hero-glow`. An inset ring never goes on an `accent` or `danger` fill (§2.6).
- **Filled buttons.** `bg-accent` and `bg-danger` reach ≥3:1 against every surface they sit on, so the button's edge is visible.
- **Current tab.** A 3 px `accent` bar (≥3:1 on every surface) plus weight and colour; never colour alone.

---

## 3. Typography

- **Display** (wordmark, h1–h3, hero): **Fraunces Variable** (`wght` 300–700, `opsz` 9–144), self-hosted from the pinned `@fontsource-variable/fraunces`, latin and latin-ext `opsz` files only, no italic. Headings use `font-display`; `font-optical-sizing: auto` drives `opsz` (the wordmark pins 32).
- **Body and UI** (and h4, labels): the system sans stack, with no download. **Code:** the system monospace stack. Tailwind's `fontFamily` is replaced, not extended.
- **No layout shift.** `app/styles/fonts.css` declares `font-display: optional`: Fraunces is used only if it arrives within the block period, else the fallback stays for the life of the page, so a swap can never shift layout. `root.tsx` preloads the latin file. The fallbacks (`Fraunces Fallback`: Georgia; `Fraunces Fallback Noto`: Noto Serif) carry `size-adjust` and the ascent, descent and line-gap overrides computed once by `scripts/font-fallback-metrics.mjs`. Re-run it only when the Fraunces version changes.
- **Prose** is `.prose-bt` (`app/styles/prose.css`): `max-width: 68ch`, links underlined, list markers `fg-subtle` (amber is kept for signals, §1.4), blockquote and `hr` not amber, tables and code blocks in a focusable `overflow-x-auto` region so they scroll at 360 px.

The base is 16 px. Each size is a CSS variable (`--bt-text-h1`…) in `tokens.css`, with the mobile value switching to the desktop one at `md` (768 px); each `text-*` class sets size, line height, letter-spacing and weight together, so `text-h1` is the whole style at every width. Use `text-wrap: balance` on h1–h3 and `pretty` on prose. The minimum rendered size is 12 px (`label-caps` only); nothing interactive is below 14 px.

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

---

## 4. Spacing, radii, borders, elevation

**Spacing** uses Tailwind's 4 px scale only, no arbitrary values; sizes off the scale (header height, infobox and drawer widths) are named values in `tokens.css`.

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

**Radii** replace Tailwind's defaults (`rounded-2xl` doesn't exist):

| Token          | Value   | Use                                                        |
| -------------- | ------- | ---------------------------------------------------------- |
| `rounded-none` | 0       | Banners at <md                                             |
| `rounded-sm`   | 4 px    | Inline code, small badges, checkbox                        |
| `rounded-md`   | 6 px    | Buttons, inputs, selects, tabs' top corners, skeleton bars |
| `rounded-lg`   | 10 px   | Cards, infobox, alerts, menus, toasts                      |
| `rounded-xl`   | 16 px   | Dialogs, drawer inner edge, hero panel                     |
| `rounded-full` | 9999 px | Chips, conservation badges, avatar, theme-toggle track     |

**Borders** are 1 px. The exceptions are the current-tab bar and infobox cap (3 px), the critically-endangered badge (2 px) and the focus ring (2 px). Decorative edges use `border-border`, control edges `border-border-strong`. An error control has a 2 px `danger-icon` border plus an icon and a message.

**Elevation** is a token: `--bt-shadow-1…3` (full `box-shadow` values per theme), exposed as `shadow-1`, `shadow-2`, `shadow-3`, `shadow-none`. Level 1 is cards, infobox and the scrolled header; 2 is menus and toasts; 3 is dialogs and the drawer. In dark the shadows are mostly an inner highlight, so every elevated element also has `border border-border`. The scrim behind dialogs and the drawer is `rgb(var(--bt-scrim) / var(--bt-scrim-alpha))` (0.5 light, 0.65 dark).

---

## 5. Layout and breakpoints

These are Tailwind's defaults. `app/constants/breakpoints.ts` holds the media queries scripts need, so a component that switches on a width matches the layout that switches with it. The design floor is 360 px; every page reflows at 320.

| Name | Min width                               | Layout                                                                                                                    |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| base | 0 (design floor 360 px; reflows at 320) | Single column, header controls in the bottom app bar, nav in drawer, infobox stacked                                      |
| `sm` | 640 px                                  | Wider forms, dl in grid                                                                                                   |
| `md` | 768 px                                  | Header 64 px with Menu, inline search, theme toggle and account; no bottom bar; infobox floats right; nav still in drawer |
| `lg` | 1024 px                                 | Persistent left sidebar                                                                                                   |
| `xl` | 1280 px                                 | Wider sidebar and infobox, wider gutters                                                                                  |

- The app shell is `max-width: 90rem`, centred; the canvas is full-bleed. The main column is a container, so an infobox stacks when text beside it would go below `20ch` (`@container (max-width: 36rem)`).
- **Header:** sticky, `bg-canvas`, `--bt-header-h` high (56 px below `md`, 64 px from `md`, border included), with `shadow-1` once scrolled. `html` has `scroll-padding-top` of the header plus 0.5rem, so a focused or anchored element is never hidden under it (WCAG 2.4.11). The first Tab stop is a "Skip to content" link.
- **Below `md`** the header holds only the logo, and a fixed **bottom app bar** (`BottomBar`, 56 px plus the safe-area inset, three equal cells: Menu, Search, Account, each at least 44 px tall with a visible label) holds the controls, and the theme toggle moves into the drawer. The page keeps `pb-app-bar` clear under its end.
- **From `lg`** the left sidebar (`<nav aria-label="Site">`, 15 rem, 16 rem at `xl`) is persistent and sticks below the header; below `lg` the same navigation is in the drawer.

---

## 6. Motion

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

The keyframes are `animate-spin`, `animate-pulse-soft`, `animate-shimmer`, `animate-progress`, `animate-flicker`, `animate-fade-in`, `animate-dialog-in`, `animate-toast-in`, `animate-sheet-in` and `animate-drawer-in` (all in `tokens.css`).

- Colour and background animate on hover and focus; drawers, dialogs, menus and toasts enter and exit. Layout properties never animate on load, and theme switching never cross-fades. No animation runs longer than 600 ms; only the spinner, shimmer and progress bar loop, and only while loading.
- **Reduced motion:** every class that moves something carries `motion-safe:`, so transforms and slides vanish under `prefers-reduced-motion: reduce`. Only opacity-only animations (`motion-reduce:animate-pulse-soft`, `animate-fade-in`) apply there. `scroll-behavior: smooth` is set only under `no-preference`.

---

## 7. Dark mode: rules for authors

1. Tokens only; `dark:` is never used. If a component seems to need a theme difference, add a token.
2. Every new text-on-background pair must pass contrast in both themes (§2.7).
3. Don't use opacity to make text muted: use `fg-muted` or `fg-subtle`.
4. Check the focus ring on every surface the component can sit on.
5. Raster images never get inverted; give them `filter: none` and a 1 px `border`.

The evidence for the themes is the e2e axe pass in the default theme; screenshots in both themes are on demand (`npm run screenshots`, docs/TESTING.md).

---

## 8. Voice and microcopy

- **Friendly and plain.** Write like a helpful herald at a bardic circle: warm and clear, never cute, never legalese. Mild heritage flavour is fine in headings and empty states; avoid it in errors, buttons and labels.
- **British spelling:** "licence" the noun, "license" the verb; "colour", "organisation", "catalogue".
- **Sentence case** everywhere ("FAQ for bards"); proper nouns keep their capitals. `label-caps` is CSS-only, and the source stays sentence case.
- **"You" for the reader, "we" for the project.** Buttons start with a verb and say what will happen: "Save changes", never "OK" or "Submit".
- **Typographic punctuation in copy:** ’ and British quotes ‘…’ with “…” inside; never the straight `'` or `"`.
- **Numerals, and dates as "3 Oct 2026"** (`en-GB`). Relative dates carry the absolute date in a `<time datetime>` `title`.
- **Respect bards.** Credit names exactly as the bard uses them. Say "creator's wishes", never "restrictions", apart from the status name "Restricted". **Links only, never lyrics.** No exclamation marks except in a thank-you.
- **Errors say what happened, then what to do.** Don't blame the reader, show codes or show the API's `message`; map the API's `code` to our own copy (`app/server/api.server.ts`).

| Situation       | Write                                                                  | Not                   |
| --------------- | ---------------------------------------------------------------------- | --------------------- |
| Required field  | "Enter a display name."                                                | "Invalid input"       |
| Too long        | "Display names can be up to 64 characters." (from the shared constant) | "Max length exceeded" |
| Save failed     | "We couldn't save your changes. Check your connection and try again."  | "Error 500"           |
| Session expired | "You've been signed out. Log in again and we'll bring you back here."  | "Unauthorised"        |
| Offline         | "You seem to be offline. Your changes haven't been saved yet."         | "Network error"       |

- **Fixed strings.** Non-affiliation: "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation." External links read "(external link)", and the original wiki's "(opens original wiki)". Settings without JavaScript: "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it." Theme toggle: group "Theme", options "System", "Light", "Dark".

---

## 9. Accessibility (WCAG 2.2 AA)

- **Semantic HTML first.** Every control is a real link or form, enhanced with JS second. Navigation, the theme toggle, the drawer and the account menu work without JavaScript (the drawer falls back to an anchor to `#site-nav`); Settings shows its notice.
- **Targets:** at least 24 px everywhere, 44 × 44 px for primary controls on mobile.
- **Focus** is always visible and never hidden by the sticky header or the app bar (`scroll-padding` above). It is an outset blue ring (`--bt-focus`), distinct from amber selection; never inside an `accent` or `danger` fill. A dialog, drawer or sheet returns focus to its trigger when it closes, and Escape closes it.
- **Not colour alone:** every state has an icon, a word or a shape (§2.5, §4.3).
- **Reflow:** no horizontal scroll at 320 CSS px (1280 at 400 % zoom) except tables and code in their own scroll region. e2e checks 360 px; text spacing overrides must not clip.
- **Reduced motion and forced colours:** §6; controls and current and pressed states stay visible under `forced-colors: active` (borders and outlines, never fill alone).
- **Checks:** axe runs once per page template in the default theme (e2e), and component tests use the keyboard. Axe finds only part of this: tab through a change, and test it at 200 % zoom.
