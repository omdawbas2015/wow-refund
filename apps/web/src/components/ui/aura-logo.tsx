import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand chip rendered from the asset shipped under
 * `/public/brand/aura-mark.png` (the wordmark sits on the gradient
 * already, so the chip is the image — no extra background).
 *
 * Aspect is 2.5:1 to match the cropped wordmark, so the AURA letters
 * read clearly even at small sizes (slot into the payment-strip row
 * next to Apple Pay / KNET / Mastercard at the same height).
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
  const width = Math.round(size * 2.5);
  const radius = Math.max(2, Math.round(size * 0.22));

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center justify-center overflow-hidden ring-1 ring-inset ring-black/5',
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
