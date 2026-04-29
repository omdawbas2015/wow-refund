import { cn } from '@/lib/utils';

/**
 * Aura wordmark — geometric `AURA` lockup with the macron bar floating
 * above the leading A, drawn as inline HTML so it inherits the page
 * font and renders crisp at every size. Sits on a light chip alongside
 * Apple Pay / KNET / Mastercard so the four payment marks read as one
 * family. The bar is what carries the brand recognition; the letters
 * are intentionally clean.
 *
 * `size` controls the type size in pixels. The wordmark is laid out
 * with letter-spacing so it stays balanced from 8px up to 24px.
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
  // Bar dimensions are derived from the type size so the lockup keeps
  // the same proportions whether it's a chip-fit 8px or a sidecar 18px.
  const barWidth = size * 0.55;
  const barHeight = Math.max(1, Math.round(size * 0.13));
  const barOffset = size * 0.28;

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex items-baseline whitespace-nowrap leading-none',
        className,
      )}
      style={{
        color: '#E6007E',
        fontWeight: 800,
        fontSize: `${size}px`,
        letterSpacing: '0.04em',
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
      }}
    >
      <span className="relative inline-block">
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-[1px] bg-current"
          style={{
            top: `-${barOffset}px`,
            width: `${barWidth}px`,
            height: `${barHeight}px`,
          }}
        />
        A
      </span>
      <span>URA</span>
    </span>
  );
}
