import { cn } from '@/lib/utils';

/**
 * Aura brand mark — crisp SVG rendering of the official teal Aura badge.
 * Renders at any size without pixelation.
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
  const h = Math.max(12, size);
  const w = Math.round(h * 2.1);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('inline-flex flex-none items-center leading-none', className)}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 84 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <rect x="0.5" y="0.5" width="83" height="39" rx="3" fill="#194C5A" stroke="#194C5A" />
        <text
          x="42"
          y="28"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="22"
          fontWeight="400"
          letterSpacing="3"
          fill="#FFFFFF"
        >
          AURA
        </text>
      </svg>
    </span>
  );
}

/**
 * Aura points badge — teal pill with crisp SVG Aura logo + points value.
 */
export function AuraPointsBadge({
  points,
  className,
  suffix = 'pts',
}: {
  points: number;
  className?: string;
  suffix?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[#194C5A]/15 bg-[#F0F6F7] px-2.5 py-0.5 text-xs font-medium text-[#194C5A]',
        className,
      )}
    >
      <AuraLogo size={12} />
      <span aria-hidden="true" className="opacity-30">
        ·
      </span>
      <span className="font-mono tabular-nums">
        {points.toLocaleString()} {suffix}
      </span>
    </span>
  );
}
