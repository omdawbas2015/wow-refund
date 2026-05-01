import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura brand mark — official wordmark image, served from /brand/aura-wordmark.png.
 * The source image has intrinsic aspect ratio ~2.8:1; we derive width from height.
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
  const h = Math.max(10, size);
  const w = Math.round(h * 2.8);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('inline-flex flex-none items-center leading-none', className)}
    >
      <Image
        src="/brand/aura-wordmark.png"
        alt={title}
        width={w}
        height={h}
        priority
        className="block h-auto w-auto object-contain"
        style={{ height: `${h}px`, width: 'auto' }}
      />
    </span>
  );
}

/**
 * Aura points badge — pill with the wordmark + points value.
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
        'inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <AuraLogo size={12} />
      <span aria-hidden="true" className="opacity-30">
        ·
      </span>
      <span className="font-mono tabular-nums">
        {points.toLocaleString()} {suffix}
      </span>
    </span>
  );
}
