import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand chip rendered as just the circular icon mark
 * (the magenta circle with the Arabic أورا inside) — no wordmark,
 * no surrounding white field. Using only the icon makes the badge
 * read at the same density as Apple Pay / KNET / Mastercard chips
 * and avoids the wide white halo the full wordmark version produced.
 */
export function AuraLogo({
  size = 20,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/brand/aura-icon.png"
      alt={title}
      title={title}
      width={size * 2}
      height={size * 2}
      className={cn('inline-block flex-none object-contain', className)}
      style={{ height: `${size}px`, width: `${size}px` }}
      priority={false}
    />
  );
}
