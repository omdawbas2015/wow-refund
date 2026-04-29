import { cn } from '@/lib/utils';

/**
 * Aura brand mark — drawn lockup matching the rest of the payment-chip
 * strip (KNET / Apple Pay / Mastercard). White AURA wordmark on Aura's
 * brand-blue (#3366ff) field, with the macron bar above the leading A
 * that identifies the brand.
 *
 * `size` is the rendered chip height in px. The chip keeps the standard
 * card-aspect ratio (≈1.55:1) so it slots into the same row as other
 * payment marks without throwing the alignment off.
 */
export function AuraLogo({
  size = 28,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  // Card-chip aspect ratio (matches `Chip` in payment-method-icons.tsx).
  const width = Math.round(size * 1.55);
  // Optical sizing — wordmark fills the chip without crowding edges.
  const fontPx = Math.round(size * 0.32);
  const barWidth = fontPx * 1.85;
  const barHeight = Math.max(1, Math.round(fontPx * 0.18));
  const barOffset = fontPx * 0.32;
  const radius = Math.max(2, Math.round(size * 0.12));

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex flex-none items-center justify-center bg-[#3366ff]',
        className,
      )}
      style={{
        height: `${size}px`,
        width: `${width}px`,
        borderRadius: `${radius}px`,
      }}
    >
      <span
        aria-hidden
        className="relative inline-flex flex-col items-center leading-none"
      >
        <span
          className="rounded-[1px] bg-white"
          style={{
            width: `${barWidth}px`,
            height: `${barHeight}px`,
            marginBottom: `${barOffset}px`,
          }}
        />
        <span
          className="font-extrabold uppercase text-white"
          style={{
            fontSize: `${fontPx}px`,
            letterSpacing: '0.12em',
          }}
        >
          AURA
        </span>
      </span>
    </span>
  );
}
