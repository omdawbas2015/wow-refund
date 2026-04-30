import { cn } from '@/lib/utils';

/**
 * Aura brand mark — compact "Aura" wordmark + small rose gradient dot.
 *
 * Previously this rendered the large `aura-mark.png` lockup, which
 * operators found oversized, mis-aligned and visually dominant in the
 * workbench + case-detail views. This redesign is a lightweight,
 * CSS-only chip: a tiny pink-to-magenta gradient dot + "Aura" wordmark
 * in the brand's rose colour. Much smaller footprint, scales crisply
 * at every DPI, and matches the aesthetic of the rest of the app.
 */
export function AuraLogo({
  size = 14,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  // Wordmark height matches `size`; the dot sits flush with the cap height.
  const dotPx = Math.max(6, Math.round(size * 0.6));

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center gap-1 font-semibold leading-none',
        className,
      )}
      style={{ fontSize: `${size}px`, color: '#C0006C' }}
    >
      <span
        aria-hidden="true"
        className="rounded-full bg-gradient-to-br from-[#F6339A] to-[#C0006C]"
        style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
      />
      <span className="tracking-tight">Aura</span>
    </span>
  );
}

/**
 * Aura points badge — compact pink pill that combines the Aura brand
 * mark with a formatted points value. Use this instead of rendering
 * AuraLogo + a separate points counter side-by-side: it keeps every
 * Aura points display visually identical across the Pool, case
 * details, and the new-case form.
 */
export function AuraPointsBadge({
  points,
  className,
  suffix = 'pts',
}: {
  points: number;
  className?: string;
  suffix?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[#E6007E]/20 bg-[#FFF2F8] px-2.5 py-0.5 text-xs font-medium text-[#C0006C]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#F6339A] to-[#C0006C]"
      />
      <span className="font-semibold tracking-tight">Aura</span>
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <span className="font-mono tabular-nums">
        {points.toLocaleString()} {suffix}
      </span>
    </span>
  );
}
