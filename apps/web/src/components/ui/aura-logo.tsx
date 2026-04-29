import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand chip rendered from the asset shipped under
 * `/public/brand/aura-mark.png`. Used everywhere the system needs
 * to identify Aura as a refund rail (case payment strip, batch
 * action dialogs, the new-case picker).
 *
 * `size` is the rendered chip height in px — width follows the
 * card-aspect ratio (≈1.55:1) so it slots into the same row as
 * Apple Pay / KNET / Mastercard chips without breaking alignment.
 * Defaults are deliberately small (18px) so the chip reads as a
 * payment mark instead of a dominant logo.
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
  const width = Math.round(size * 1.55);
  const radius = Math.max(2, Math.round(size * 0.18));

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center justify-center overflow-hidden bg-white',
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
        width={width}
        height={size}
        className="h-full w-full object-cover"
        priority={false}
      />
    </span>
  );
}
