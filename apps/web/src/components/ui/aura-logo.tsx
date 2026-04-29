import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner brand mark — renders the full official Aura lockup
 * (pink disc icon + magenta AURA wordmark) from `/brand/aura-mark.png`
 * at its natural ~4:1 aspect ratio. The image is never cropped or
 * composed in CSS so the wordmark always reads cleanly at every size.
 *
 * `size` controls the rendered height in pixels; width is derived from
 * the asset's native aspect ratio. `className` is merged onto the outer
 * span — pass `ring-...` here to add a border.
 */
const NATIVE_W = 320;
const NATIVE_H = 79;

export function AuraLogo({
  size = 20,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const width = Math.round((size * NATIVE_W) / NATIVE_H);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('inline-flex flex-none items-center justify-center', className)}
      style={{ height: `${size}px`, width: `${width}px` }}
    >
      <Image
        src="/brand/aura-mark.png"
        alt=""
        width={NATIVE_W}
        height={NATIVE_H}
        className="h-full w-full object-contain"
        priority={false}
      />
    </span>
  );
}
