import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Tone for the icon chip background. Defaults to soft neutral. */
  tone?: 'neutral' | 'mint' | 'lavender' | 'butter' | 'sky' | 'peach' | 'rose';
}

const TONE_CLASS: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'bg-surface-muted text-muted-foreground',
  mint: 'chip-mint',
  lavender: 'chip-lavender',
  butter: 'chip-butter',
  sky: 'chip-sky',
  peach: 'chip-peach',
  rose: 'chip-rose',
};

/**
 * Reusable empty/zero-state — used inside Cards or as a panel filler
 * when a list / table has no data. Keeps consistent typography and
 * spacing across the app.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            TONE_CLASS[tone],
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-[14.5px] font-semibold text-heading">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
