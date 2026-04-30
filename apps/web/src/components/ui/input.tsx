import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-[14px] text-foreground shadow-xs transition-all duration-200',
          'placeholder:text-muted-foreground/60',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'hover:border-border-strong',
          'focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-ring/15',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
