# DESIGN.md — WOW Refund

> Design language for the WOW Refund workspace. Light-mode only,
> Linear / Stripe / Notion / Vercel inspired. Calm, professional,
> non-decorative — every visual choice is in service of the data.

---

## 1. Principles

1. **Information first.** Every pixel either renders data or supports it.
   We never use decorative gradients, aurora washes, or glow halos.
2. **One accent.** A single deep indigo (`231 64% 48%`) is used for active
   states, links, and primary CTAs. No multi-stop brand gradient. No
   gradient avatars or logos.
3. **Restrained motion.** Hover transitions are colour changes only — no
   translate, no scale, no glow. The only entrance animation is a 200 ms
   `fade-in`. `prefers-reduced-motion` disables everything.
4. **Hairline + flat.** Surfaces are flat white panels with a 1 px border
   and at most a single subtle shadow. No `rounded-2xl` cards stacked on
   blurred backgrounds.
5. **Tight scale.** 4 px grid; 8 px corner radius default; 13 px body
   text; 12 px UI labels; tabular numerics on every metric.

---

## 2. Tokens

### Colour
- **Surfaces** are white (`--neutral-0`) on a near-white background
  (`--neutral-50`).
- **Text** uses three weights: `--heading` (almost black), `--foreground`
  (zinc-900), `--body` / `--muted-foreground` (zinc-600 / zinc-500).
- **Borders** are `--neutral-200` everywhere; rare `--border-strong`
  (`--neutral-300`) for emphasised dividers.
- **Single accent** (`--primary`): `hsl(231 64% 48%)`. Hover deepens to
  `hsl(231 68% 42%)`.
- **Status** colours (success / warning / destructive / info) are used
  only as small pill backings (50-tone bg + 700-tone text). Never as
  full surfaces.

### Type
- **Family**: Inter Variable, with `cv11, ss01, ss03` features.
- **Scale**: `display-lg` 32 / `display-md` 26 / `display-sm` 22 /
  `heading-lg` 18 / `heading-md` 15 / body 14 / caption 11.5.
- **Weights**: 400 (body), 500 (UI), 600 (headings). No light weights.

### Shape
- **Radius**: 8 px default, 6 px on small chips, 10 px on large panels.
- **Shadows**: only `shadow-card` (single 1 px ambient) and `shadow-md`
  (used sparingly for floating elements like dropdowns). No glow or
  brand-tinted shadows anywhere.

### Motion
- `transition-colors` 150 ms is the default hover. No translate, no scale.
- `animate-fade-in` and `animate-fade-in-up` are 200–240 ms one-shot
  fades for first paint. There are no infinite animations
  (no `pulse-ring`, no `gradient-pan`, no `shimmer`).

---

## 3. Layout

### Sidebar
- 228 px wide, light surface (`--neutral-50`), single hairline border.
- Brand: 24 × 24 dark square with white "W" — no gradient, no glow.
- Section labels in 10.5 px uppercase muted text.
- Nav items: 32 px tall, 12.5 px label, 14 × 14 px icon.
- Active state: `--neutral-150` background fill with near-black text;
  no gradient rail, no shadow.

### Top bar
- 48 px tall, solid white, single hairline border, no glass blur.
- Breadcrumb (12.5 px), search (`⌘K`), notifications, avatar.
- Avatar is a flat 24 × 24 dark circle with the user's initial.

### Content
- 24 px page padding.
- Page header: title (display-md) + one-line subtitle + period chip.
- Section panels: hairline border, no hover lift, divider rows for
  data tables.

---

## 4. Components

### Button
Solid filled (`primary`) or outline. Hover = single colour change. No
gradient, no translate, no glow. `h-9` default; `h-10` for `size="lg"`.

### Card
Flat: hairline border, single ambient shadow, no hover-lift, 8–10 px
corners. Section headers sit inside a hairline-bottom strip.

### Badge
Compact rectangular pill (`rounded-md`, no uppercase). Status variants
use 50-tone background + 700-tone text. Default = neutral surface.

### Input
`h-9`, 13 px text, hairline border, 2 px focus ring at 30 % opacity.
No drop shadow, no gradient on focus.

### Skeleton
`animate-pulse` on `--surface-muted`. No shimmer keyframe.

---

## 5. What this design *isn't*

To stay aligned with the principles above, do **not** introduce any of
the following without a strong reason:

- Multi-stop brand gradients on logos, buttons, or avatars.
- Aurora / radial-gradient backgrounds behind cards or pages.
- Hover translate / scale / glow effects.
- Infinite-loop animations (`pulse-ring`, `gradient-pan`, `shimmer`).
- `rounded-2xl` floating cards.
- Glass / backdrop-blur surfaces.
- Decorative tagline pills ("✨ New · Live · World-class …").

When in doubt: prefer the duller option.
