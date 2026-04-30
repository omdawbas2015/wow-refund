# DESIGN.md — WOW Refund

> Design language for the WOW Refund workspace.
> Inspired by [getdesign.md](https://getdesign.md) — Linear (precision), Stripe
> (gradient elegance), Vercel (monochrome clarity), Notion (warm neutrals).
>
> The app is **light-mode-first**, with dark tokens kept only as a graceful
> fallback. Drop this file at the repo root so AI agents (Claude, Cursor,
> Stitch) generate consistent UI.

---

## 1. Visual Theme & Atmosphere

WOW Refund is an enterprise refund workspace that should feel **calm,
high-trust, and obviously expensive**. The canvas is near-white with a faint
cool-indigo wash; surfaces float above it as crisp white cards held together by
ultra-thin borders and feather-soft shadows. The overall impression is one of
quiet precision: dense information, never noisy.

Typography is built on **Inter Variable** with OpenType features `cv11, cv02,
cv03, cv04, ss01, ss03` enabled globally for cleaner numerals and geometric
alternates. Semibold (600) carries headlines; medium (500) carries UI; tabular
numerals are used for every metric. Tracking is tightened (`-0.025em`) at
display sizes for a compressed, engineered feel.

The single chromatic accent is an **indigo → violet → magenta gradient** —
used sparingly on the brand mark, primary CTA, sidebar active rail, and avatar
chip. Status colors (green / amber / rose / sky) appear only as pill backings
or icon foregrounds, never as solid surfaces.

**Key Characteristics**

- Light-mode-native: warm-tinted off-white background (`hsl(240 25% 98.5%)`),
  pure-white cards, ultra-thin borders (`hsl(224 18% 90%)`).
- Inter Variable; 510-ish medium for UI, 600 for headings, tabular numerals.
- Negative tracking at display sizes (`-0.025em`).
- Brand gradient `indigo → violet → magenta` (`#5b6cf2 → #8b5cf6 → #ec4899`)
  used sparingly.
- Soft, feathered shadow stack — never harsh box-shadows.
- Aurora-style radial wash behind hero / auth panels.
- Border-led structure (1px borders + tiny shadows) over heavy elevation.
- Lucide icons throughout, sized 14–18px in UI, with hover-scale micro-motion.
- Animations: fade-in-up, count-up, gradient-pan, pulse-ring; respect
  `prefers-reduced-motion`.

---

## 2. Color Palette & Roles

### Surfaces

| Token             | HSL                  | Use                                |
| ----------------- | -------------------- | ---------------------------------- |
| `--background`    | `240 25% 98.5%`      | Page canvas (warm off-white).      |
| `--surface`       | `0 0% 100%`          | Cards, modals, popovers.           |
| `--surface-subtle`| `240 20% 97%`        | Hover row, table zebra.            |
| `--surface-muted` | `240 14% 95%`        | Disabled / muted blocks.           |
| `--sidebar-bg`    | `240 30% 99%`        | Left navigation rail.              |

### Text

| Token                | HSL              | Use                          |
| -------------------- | ---------------- | ---------------------------- |
| `--heading`          | `224 32% 9%`     | h1–h6, KPI numerics.         |
| `--foreground`       | `224 30% 12%`    | Default body text.           |
| `--label`            | `224 16% 28%`    | Form labels, meta.           |
| `--body`             | `222 12% 42%`    | Long-form prose.             |
| `--muted-foreground` | `222 10% 50%`    | Captions, placeholders.      |

### Borders

| Token             | HSL              | Use                            |
| ----------------- | ---------------- | ------------------------------ |
| `--border`        | `224 18% 90%`    | Default 1px hairline.          |
| `--border-strong` | `224 18% 84%`    | Hover-state border, scrollbar. |

### Brand & Status

| Token            | HSL              | Use                             |
| ---------------- | ---------------- | ------------------------------- |
| `--primary`      | `250 92% 62%`    | Primary CTA, active state.      |
| `--brand-from`   | `243 75% 60%`    | Indigo (gradient stop 1).       |
| `--brand-via`    | `266 90% 64%`    | Violet (gradient stop 2).       |
| `--brand-to`     | `322 90% 62%`    | Magenta (gradient stop 3).      |
| `--success`      | `152 70% 40%`    | Refunded / completed.           |
| `--warning`      | `36 95% 50%`     | Pending approval / awaiting.    |
| `--destructive`  | `358 78% 56%`    | Rejected / cancelled / errors.  |
| `--info`         | `217 91% 58%`    | Notifications, neutral info.    |

The **brand gradient** (`linear-gradient(135deg, brand-from, brand-via,
brand-to)`) is the only multi-stop gradient in the system. Use it on:

- Brand mark (sidebar logo, auth logo).
- Primary CTA (`<Button>` default variant) — pans on hover.
- Active sidebar row indicator (3px-wide left rail).
- User avatar chip in the top bar.
- Aurora radial wash behind hero cards (at very low opacity).

---

## 3. Typography

```
Family:   Inter Variable, system-ui, -apple-system, "Segoe UI"
Mono:     JetBrains Mono, ui-monospace, "SF Mono"
Features: cv11, cv02, cv03, cv04, ss01, ss03
```

| Role          | Size / line-height | Weight | Tracking   |
| ------------- | ------------------ | ------ | ---------- |
| Display XL    | 56 / 1.10          | 300    | -0.025em   |
| Display LG    | 48 / 1.10          | 300    | -0.020em   |
| Display MD    | 36 / 1.15          | 300    | -0.014em   |
| Heading LG    | 24 / 1.25          | 500    | -0.010em   |
| Heading MD    | 18 / 1.30          | 500    | normal     |
| Heading SM    | 15 / 1.35          | 500    | normal     |
| Body LG       | 16 / 1.50          | 400    | normal     |
| Body MD       | 14 / 1.50          | 400    | normal     |
| Body SM       | 13 / 1.40          | 400    | normal     |
| Caption       | 12 / 1.30          | 500    | 0.05em     |

Numbers always render with `tabular-nums` (helper class `.tabular`).

---

## 4. Spacing & Radius

- Spacing scale: Tailwind defaults (`0.5 → 1 → 1.5 → 2 → 3 → 4 → 6 → 8 …`).
- Card padding: `p-5` for KPI tiles, `p-6` for panels.
- Gap between cards: `gap-4` (16px).
- Radius:
  - `--radius: 0.75rem` (12px) baseline.
  - `rounded-xl` (16px) for tiles.
  - `rounded-2xl` (24px) for hero / auth cards.
  - `rounded-full` for pills, avatars, status chips.

---

## 5. Elevation (Shadows)

A 7-step shadow ladder, all **near-zero saturation, large blur radii** so they
feel feathered. Never use harsh / Material-style shadows.

```
xs           : 0 1px 1px rgba(15,23,42,0.04)
sm           : 0 1px 2px rgba(15,23,42,0.05), 0 1px 1px rgba(15,23,42,0.03)
DEFAULT      : 0 2px 6px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)
md           : 0 4px 12px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.04)
lg           : 0 12px 28px rgba(15,23,42,0.08), 0 4px 8px rgba(15,23,42,0.04)
xl           : 0 24px 56px rgba(15,23,42,0.12), 0 8px 16px rgba(15,23,42,0.05)
glow         : 0 0 0 1px primary/0.10, 0 8px 24px primary/0.18
brand-glow   : 0 8px 24px brand-via/0.25, 0 2px 8px brand-from/0.15
```

Cards use `shadow-card` (a 1px ring + tiny drop). On hover they lift `-1px` and
fade to `shadow-card-hover`.

---

## 6. Components

### Button

- **Default**: brand-gradient surface, white text, `bg-[length:200%_200%]` so
  the gradient pans on hover. Hover lifts `-1px` and adds `shadow-glow`.
  Active scales to `0.98`.
- **Outline**: 1px border + white, hover swaps border to `primary/40`.
- **Ghost**: transparent, hover swaps to `surface-subtle`.
- **Destructive**: solid `--destructive` red, no gradient.
- All buttons: focus ring `ring-ring/50` with 2px offset, 200ms `ease-out-quart`
  transitions, icon scale on group hover.

### Card

- `rounded-2xl`, 1px `border/70`, `shadow-card`.
- Hover: `-translate-y-0.5`, `border-strong/80`, `shadow-card-hover` over 300ms.
- Top edge gradient line appears on group-hover for KPI tiles.

### Sidebar

- Light background (`--sidebar-bg` = `240 30% 99%`), 1px right border, faint
  aurora radial wash at top.
- Logo: 36×36 rounded-xl with `bg-brand-gradient` + `shadow-brand-glow` and a
  white `ring-1`.
- Active item: `--sidebar-active-bg` (`primary/5` tint) + 3px gradient rail on
  the left edge, glowing softly.
- Hover: `bg-sidebar-hover` + icon scale `1.05`.
- Section labels: 10px uppercase, tracking `0.12em`, very low contrast.
- Search button: matches input styling, shows `⌘K` kbd.

### Top Bar

- 56px tall, sticky, `glass` background (white/65 + 12px backdrop blur).
- Left: breadcrumb chain rendered with `ChevronRight` separators and route map.
- Right: quick-search button, notifications bell, divider, avatar chip.
- Avatar: 28px circle with `bg-brand-gradient`, white initial, `ring-2 ring-white`.

### Auth Layout

- Two-column: 52% branding on the left (hidden < lg), 48% form on the right.
- Background: `bg-brand-aurora` (3 radial gradients) + faint dot grid masked by
  a soft radial.
- Form lives in a `rounded-2xl` glassy card with a faint top gradient hairline.
- Left column: badge + display heading where the second half uses
  `text-brand-gradient` and `animate-gradient-pan`.
- Three feature pills: each is a 1px-bordered card with a gradient-soft icon
  bubble and a description; staggered `animate-fade-in-up`.

### Dashboard Hero

- A `rounded-2xl` panel sitting above the KPIs with the aurora wash, a faint
  brand-gradient blur in the top-right, a "Live overview" pill (with
  `animate-pulse-ring`), the greeting, and a date-range chip.

### KPI Tile

- `rounded-2xl`, white, soft shadow; 32px tabular numeric value.
- Top-right: 36px `rounded-xl` icon bubble in a tinted color (indigo / amber /
  emerald / violet), `ring-1 ring-inset`, scales `1.10` on group hover.
- Bottom: percentage delta in a tiny green/rose pill + subdued date-range.
- Stagger: `animate-fade-in-up` with 70ms increments.

### Badge

- `rounded-full`, 11px uppercase letterspaced, 1px tinted border + tinted background.
- Variants: `default`, `secondary`, `destructive`, `success`, `warning`,
  `info`, `outline`, `gradient` (uses brand gradient for special use).

### Input

- 44px tall, 1px border, `shadow-xs`.
- Focus: 4px `ring-ring/15` + `border-primary/60`.
- Hover: `border-strong`.

---

## 7. Iconography

- **Library**: [Lucide](https://lucide.dev) (already a dependency).
- Default size 16px (h-4 w-4) in UI, 14px (h-3.5 w-3.5) in dense rows, 18px in
  empty states. 1.75 stroke.
- Icons in interactive surfaces: `transition-transform duration-200`, slight
  scale or translate on group hover.
- Color: inherit current text color; status icons get the matching status hue.
- Use icon **bubbles** (rounded-xl, ring-1, tinted bg) to give icons weight in
  KPI tiles and pending-task lists.

---

## 8. Motion

All transitions use `cubic-bezier(0.25, 1, 0.5, 1)` (`ease-out-quart`) by
default. Durations: 150–300ms for micro-interactions, 400–540ms for entrances.
Always honor `prefers-reduced-motion`.

| Animation             | Use                                 |
| --------------------- | ----------------------------------- |
| `fade-in`             | Background overlays, route changes. |
| `fade-in-up`          | Cards, KPIs, list rows (stagger).   |
| `slide-in-left/right` | Drawer / panel entrance.            |
| `scale-in`            | Modals, popovers, auth card.        |
| `count-up`            | Numeric KPI values.                 |
| `gradient-pan`        | Hero text, primary CTA gradient.    |
| `pulse-ring`          | Live status dot (e.g. dashboard).   |
| `float`               | Decorative brand mark hover (subtle).|
| `shimmer`             | Skeleton loading state.             |

A `.stagger` helper applies sequential delays (40ms → 460ms) to direct
children, used on feature lists and KPI grids.

---

## 9. Layout & Structure

- App shell: 248px sidebar + flexible main column.
- Page padding: `px-6 py-7` for dashboard / list pages.
- Max content width: full-bleed (no container narrowing). Tables and panels
  fill the available space; the eye is anchored by the surrounding cards.
- Sticky top bar above all scrolling content.
- Gap rhythm: `mb-7` after hero, `mt-6` between major sections, `gap-4`
  between cards.

---

## 10. Empty States

- 1px-bordered, faint dot-grid background, centered icon bubble + heading +
  CTA. Always uses Lucide for the illustrative glyph; never raster art.

---

## 11. AI agent prompt cheatsheet

When asking an AI agent to build or refactor a screen, paste the snippet below
along with this DESIGN.md:

```
Use DESIGN.md tokens:
  - Light mode only, near-white canvas with brand aurora wash.
  - 1px borders + soft shadow-card; rounded-2xl for panels, rounded-xl for tiles.
  - Brand gradient (indigo→violet→magenta) ONLY on the primary CTA, brand mark,
    avatar chip, and active sidebar rail. Status pills stay flat.
  - Inter Variable, headings 600 with -0.025em tracking, tabular numerals.
  - Lucide icons in tinted rounded-xl bubbles for KPIs and list rows.
  - Animations: fade-in-up with stagger, count-up for numerics, gradient-pan
    on the hero word and primary CTA. Honor prefers-reduced-motion.
```
