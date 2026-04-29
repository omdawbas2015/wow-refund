import { cn } from '@/lib/utils';

/**
 * Aura brand mark — soft squircle with a radial highlight and a hand-
 * lettered A wordmark. Uses gradient + inner glow so it reads as a
 * modern loyalty badge rather than a flat pink disc.
 *
 * Rendered as inline SVG so it scales crisply and inherits sizing from
 * the caller. The color palette is Aura's brand pink tuned toward a
 * magenta → coral gradient.
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
  const gradId = `aura-grad-${size}`;
  const glowId = `aura-glow-${size}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4FA2" />
          <stop offset="55%" stopColor="#E6007E" />
          <stop offset="100%" stopColor="#9A0063" />
        </linearGradient>
        <radialGradient id={glowId} cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Rounded squircle base */}
      <rect
        x="4"
        y="4"
        width="112"
        height="112"
        rx="32"
        ry="32"
        fill={`url(#${gradId})`}
      />
      {/* Soft top-left highlight */}
      <rect
        x="4"
        y="4"
        width="112"
        height="112"
        rx="32"
        ry="32"
        fill={`url(#${glowId})`}
      />

      {/* Stylised "A" — two tapered strokes meeting at an apex, with a
          crossbar that reads as the horizon line on the loyalty mark. */}
      <g
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M36 86 L60 32 L84 86" strokeWidth="10" />
        <path d="M47 66 L73 66" strokeWidth="8" />
      </g>

      {/* Ring accent — subtle outer halo */}
      <rect
        x="4"
        y="4"
        width="112"
        height="112"
        rx="32"
        ry="32"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
    </svg>
  );
}
