import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura brand mark — renders the official Aura wordmark PNG
 * (`/brand/aura-mark.png`, ~3:1 aspect ratio) so every surface in the
 * app shows the exact same brand lockup the operator sees on Aura's
 * own communications. `size` is the rendered height in pixels; width
 * is derived from the image's natural aspect ratio so the mark scales
 * crisply without distortion.
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
  // aura-mark.png is 640×212 (≈3.02:1).
  const ratio = 640 / 212;
  const width = Math.round(size * ratio);
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('inline-flex flex-none items-center', className)}
      style={{ height: `${size}px`, width: `${width}px` }}
    >
      <Image
        src="/brand/aura-mark.png"
        alt={title}
        width={640}
        height={212}
        priority={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/**
 * Aura points badge — compact pink pill that combines the Aura
 * wordmark with a formatted points value. Use this instead of rendering
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
      <AuraLogo size={12} />
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <span className="font-mono tabular-nums">
        {points.toLocaleString()} {suffix}
      </span>
    </span>
  );
}
