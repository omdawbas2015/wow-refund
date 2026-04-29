import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura brand mark — renders the official AURA wordmark provided by the
 * brand team. Two visual variants are exposed:
 *
 * - `mark` (default): the white wordmark on Aura's brand-blue field. The
 *   image carries its own background, so this variant slots straight
 *   into a payment-chip strip without needing an extra wrapper.
 * - `wordmark`: the larger, full-color gradient lockup. Use this for
 *   feature areas / headers where the brand is the focal point.
 *
 * `size` is the rendered height in px; width is derived from the asset's
 * intrinsic ratio so the logo never gets squished.
 */
export function AuraLogo({
  size = 28,
  variant = 'mark',
  className,
  title = 'Aura',
}: {
  size?: number;
  variant?: 'mark' | 'wordmark';
  className?: string;
  title?: string;
}) {
  // Intrinsic ratios derived from the source PNGs.
  const ratio = variant === 'wordmark' ? 1400 / 787 : 650 / 365;
  const width = Math.round(size * ratio);
  const src =
    variant === 'wordmark' ? '/brand/aura-wordmark.png' : '/brand/aura-mark.png';

  return (
    <Image
      src={src}
      alt={title}
      width={width}
      height={size}
      priority={false}
      unoptimized
      className={cn('inline-block', className)}
      style={{ height: `${size}px`, width: `${width}px` }}
    />
  );
}
