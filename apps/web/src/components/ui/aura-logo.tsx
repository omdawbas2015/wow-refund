import { cn } from '@/lib/utils';

/**
 * Aura brand mark. A clean, type-led monogram: an angular "A" stroked
 * in Aura magenta with a subtle dot (the loyalty pip) anchored in the
 * lower-right quadrant. No fill, no glow, no squircle — the mark is
 * confident at 16 px and elegant at 64 px because every line carries
 * weight.
 *
 * Renders inline so it inherits caller sizing and stays crisp on
 * retina. Uses currentColor for the dot so it picks up theme accents
 * cleanly (we still draw the strokes in brand magenta so it reads as
 * Aura wherever it sits).
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
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <title>{title}</title>
      {/* Angular A monogram — two diagonals + crossbar, all stroked.
          Coordinates kept on a 32-grid so the lines snap cleanly at
          common sizes (16, 24, 32, 48). */}
      <g
        fill="none"
        stroke="#E6007E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 26 L16 6 L26 26" />
        <path d="M11 19 L21 19" strokeWidth="2.2" />
      </g>
      {/* Loyalty pip — small filled dot tucked under the right leg. */}
      <circle cx="26" cy="26" r="2" fill="#E6007E" />
    </svg>
  );
}
