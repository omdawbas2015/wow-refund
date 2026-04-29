import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Aura partner-brand chip — magenta circle icon + 'AURA' wordmark in
 * the official Aura magenta (#ee0677) on a white field. Composed in
 * CSS rather than reusing the full bitmap lockup so the chip can sit
 * at the same h-9 / w-14 footprint as the Apple Pay / KNET / Mastercard
 * chips without the white halo the bitmap wordmark introduced.
 *
 * `size` controls the chip height; the chip is laid out at a fixed
 * 14:9 ratio (matches the payment chips). `className` is merged onto
 * the outer chip span — pass `ring-...` here to add a border.
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
  // ~2.2 : 1 aspect — enough to fit the 16px 'AURA' wordmark next to
  // the circular Aura mark without clipping. Earlier iterations used a
  // 14:9 ratio to match the credit-card chips, but the wordmark got
  // truncated to 'AUF' at every render size.
  const width = Math.round(size * 2.2);
  const radius = Math.max(2, Math.round(size * 0.18));
  const iconSize = Math.round(size * 0.78);
  const wordmarkSize = Math.round(size * 0.58);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center justify-center gap-[3px] overflow-hidden bg-white px-1 ring-1 ring-inset ring-black/10',
        className,
      )}
      style={{
        height: `${size}px`,
        width: `${width}px`,
        borderRadius: `${radius}px`,
      }}
    >
      <Image
        src="/brand/aura-icon.png"
        alt=""
        width={iconSize * 2}
        height={iconSize * 2}
        className="object-contain"
        style={{ height: `${iconSize}px`, width: `${iconSize}px` }}
        priority={false}
      />
      <span
        className="font-semibold leading-none tracking-[0.04em] text-[#ee0677]"
        style={{ fontSize: `${wordmarkSize}px` }}
      >
        AURA
      </span>
    </span>
  );
}
