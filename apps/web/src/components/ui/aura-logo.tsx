import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand lockup — renders the official `aura-mark.png`
 * bitmap (circular icon + 'AURA' wordmark) at its native 320 x 79 ratio
 * so the wordmark never clips. `size` controls the chip height; the
 * chip width follows naturally from the 320 : 79 ratio.
 */
const NATIVE_WIDTH = 320;
const NATIVE_HEIGHT = 79;

export function AuraLogo({
  size = 20,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const width = Math.round((size * NATIVE_WIDTH) / NATIVE_HEIGHT);

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
        width={NATIVE_WIDTH}
        height={NATIVE_HEIGHT}
        priority={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
