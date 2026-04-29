import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand chip rendered from the official Aura logo
 * (magenta circular mark + wordmark) shipped under
 * `/public/brand/aura-mark.png`.
 *
 * The asset is already 322x120 (~2.7:1) on a transparent background,
 * so we just place it on a white chip with `object-contain` and a
 * tiny inset; that keeps the wordmark fully readable from 16px up.
 */
export function AuraLogo({
  size = 18,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const width = Math.round(size * 2.7);
  const radius = Math.max(2, Math.round(size * 0.22));

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-black/5',
        className,
      )}
      style={{
        height: `${size}px`,
        width: `${width}px`,
        borderRadius: `${radius}px`,
      }}
    >
      <Image
        src="/brand/aura-mark.png"
        alt={title}
        width={width * 2}
        height={size * 2}
        className="h-full w-full object-contain p-[2px]"
        priority={false}
      />
    </span>
  );
}
