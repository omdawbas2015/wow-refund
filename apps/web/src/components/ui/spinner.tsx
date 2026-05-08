import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/** Tiny consistent spinner. Use inline next to button labels or as a
 *  block-level loading indicator inside cards. */
export function Spinner({ size = 'md', label, className, ...props }: SpinnerProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      role="status"
      aria-label={label ?? 'Loading'}
      {...props}
    >
      <Loader2 className={cn('animate-spin', SIZE[size])} />
      {label ? <span className="text-[12px]">{label}</span> : null}
    </div>
  );
}
