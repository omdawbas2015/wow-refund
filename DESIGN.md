# DESIGN.md — Alshaya Refund

> Professional, dashboard-first design language inspired by Alshaya's
> corporate brand: clean cool surfaces, a single deep navy accent, and
> tonal blue chips for navigation and KPIs. The goal is calm, restrained,
> and unmistakably enterprise.

---

## 1. Principles

1. **Cool near-white over pure white.** The page background is a faintly
   blue-tinted off-white; panels lift to pure white. We never sit white
   on white, and we never use warm cream.
2. **One accent — Alshaya navy.** `hsl(215 70% 30%)` is used on the
   primary CTA, hero KPI card, sidebar brand chip, avatar, and active
   nav chip. Hover deepens to `hsl(215 76% 24%)`.
3. **Tonal chips, not rainbow.** Every nav item, KPI card, and
   pending-task row has its icon inside a soft tinted square — light
   navy, soft teal, periwinkle, cool slate, sky, or muted rose. The
   chip carries colour so the rest of the surface stays calm.
4. **Generous radius.** 12 px default, 18–28 px on cards, pill on
   buttons / chips / avatars. Nothing is square.
5. **Restrained motion.** Hover transitions are colour changes only —
   no translate, no scale, no glow. Only `fade-in` (200 ms) and
   `fade-in-up` (240 ms) on first paint. `prefers-reduced-motion`
   disables everything.

---

## 2. Tokens

### Colour
- **Background**: faintly blue-tinted off-white `--neutral-50`
  (`hsl(214 24% 97.5%)`).
- **Surfaces**: pure white (`--neutral-0`) for panels and cards;
  `--surface-subtle` ultra-light blue wash for input backgrounds.
- **Text**: `--heading` (near black with a cool cast), `--foreground`,
  `--muted-foreground`.
- **Border**: cool hairline `--neutral-150`.
- **Primary**: Alshaya-inspired navy `hsl(215 70% 30%)` with white
  foreground for AAA contrast.
- **Status**: `success` mint, `warning` amber, `destructive` rose,
  `info` sky — all at low chroma.

### Pastel chips
`--chip-butter`, `--chip-mint`, `--chip-lavender`, `--chip-peach`,
`--chip-sky`, `--chip-rose`. Each has a low-saturation background +
saturated foreground. Use the matching utility class
(`chip-butter`, `chip-mint`, …) on a 28 × 28 rounded-xl square that
contains the icon.

### Type
- **Family**: Inter Variable, with `cv11, ss01, ss03` features.
- **Scale**: `display-md` 28 / `heading-md` 15 / body 14 / caption
  11.5.
- **Weights**: 400 body, 500 UI, 600 headings.

### Shape
- **Radius**: 12 px default, 14 / 18 / 22 / 28 px ladder; `pill`
  (9999 px) for buttons and chips.
- **Shadows**: `shadow-xs` ambient on selected sidebar row only — no
  glow, no brand-tinted shadows.

### Motion
- `transition-colors` 150 ms is the default hover.
- `animate-fade-in` and `animate-fade-in-up` for first paint.
- No infinite loops. No translate / scale on hover.

---

## 3. Layout

### Sidebar (244 px)
- Cream surface, no left-border separation, soft hairline on the
  right.
- **Brand**: 32 × 32 yellow rounded-2xl chip with a bold "W".
- **Search**: rounded-pill input with `⌘K` kbd.
- **Nav rows**: 40 px tall, 28 × 28 pastel chip on the left, label,
  optional badge on the right.
- **Active state**: white card under the row with a subtle ambient
  shadow; the chip flips from pastel to solid butter yellow.
- **Footer**: Profile, Settings, Sign out (rose chip).

### Top bar
- 56 px tall, transparent over the cream background (no border).
- Breadcrumb on the left, pill-shaped search, notification bell, and a
  pill avatar chip with a yellow circle + initial.

### Auth
- Full-screen cream wash, header (logo + name), centred white
  rounded-3xl card holding the form.

### Page content
- 24 px page padding.
- KPI hero (yellow card) sits beside white side cards.
- Section panels are rounded-3xl white cards with hairline border.

---

## 4. Components

### Button
- `rounded-pill`, h-9 default. Filled = butter yellow with cocoa text.
  Outline / ghost / link variants stay neutral. No translate, no glow.

### Card
- `rounded-2xl`, hairline border. No hover-lift.

### Badge
- `rounded-pill`, 11 px text. Status variants use 50-tone background
  + 700-tone text.

### Input
- `rounded-xl`, h-10, cream-tinted background; switches to white on
  focus with a 2 px butter ring.

### Skeleton
- `animate-pulse` on `--surface-muted`. No shimmer keyframe.

---

## 5. What this design *isn't*

To stay aligned with the reference, do **not** introduce any of the
following without a strong reason:

- Multi-stop indigo/violet/magenta brand gradients.
- Aurora / radial-gradient backgrounds.
- Hover translate / scale / glow effects.
- Infinite-loop animations (`pulse-ring`, `gradient-pan`, `shimmer`).
- Square panels (`rounded-md` cards, `rounded-md` chips).
- Glass / backdrop-blur surfaces.
- Decorative tagline pills ("✨ Live · World-class …").

When in doubt: keep it warm, soft, and quiet.
