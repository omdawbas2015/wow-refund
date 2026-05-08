import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent page header used across the dashboard. Provides a title,
 * optional description, optional eyebrow chip, and a slot for actions
 * on the trailing edge. Replaces the ad-hoc h1 + p + flex pattern that
 * was repeated in every page.
 */
interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  size = 'md',
  className,
  ...props
}: PageHeaderProps) {
  const titleClass =
    size === 'lg'
      ? 'text-display-md text-heading'
      : size === 'sm'
        ? 'text-display-sm text-heading'
        : 'text-display-sm text-heading';
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 inline-flex items-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className={cn('font-semibold tracking-tight', titleClass)}>{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
