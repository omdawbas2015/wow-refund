import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Soft rounded-pill badge.
  'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-muted text-foreground',
        secondary: 'border-border bg-surface-muted text-foreground',
        destructive: 'border-rose-200 bg-rose-50 text-rose-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        info: 'border-sky-200 bg-sky-50 text-sky-700',
        outline: 'border-border bg-surface text-foreground',
        gradient: 'border-primary/20 bg-primary/10 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
