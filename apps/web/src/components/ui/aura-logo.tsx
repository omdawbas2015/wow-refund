/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

/**
 * Aura brand mark — renders the official Aura logo from /brand/aura-points.png.
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
  const imgH = Math.max(14, size);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center leading-none',
        className,
      )}
    >
      <img
        src="/brand/aura-points.png"
        alt={title}
        style={{ height: `${imgH}px`, width: 'auto' }}
        className="object-contain"
      />
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
        'inline-flex items-center gap-1.5 rounded-full border border-[#1B4D5A]/20 bg-[#F0F7F8] px-2.5 py-0.5 text-xs font-medium text-[#1B4D5A]',
        className,
      )}
    >
      <img
        src="/brand/aura-points.png"
        alt="Aura"
        className="h-3 w-auto object-contain"
      />
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <span className="font-mono tabular-nums">
        {points.toLocaleString()} {suffix}
      </span>
    </span>
  );
}
