import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base — micro-interactions: hover lift, active press, focus ring, icon scale
  [
    'group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13.5px] font-medium tracking-tight',
    'transition-all duration-200 ease-out-quart',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200',
    'active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'text-primary-foreground shadow-sm',
          'bg-brand-gradient bg-[length:200%_200%] bg-[position:0%_50%]',
          'hover:bg-[position:100%_50%] hover:shadow-glow hover:-translate-y-px',
          'active:shadow-sm active:translate-y-0',
        ].join(' '),
        solid:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md hover:-translate-y-px active:shadow-sm active:translate-y-0',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:brightness-95 hover:shadow-md hover:-translate-y-px',
        outline:
          'border border-border bg-surface text-foreground shadow-xs hover:bg-surface-subtle hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/70 hover:shadow-sm',
        ghost:
          'text-foreground hover:bg-surface-subtle hover:text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
        success:
          'bg-success text-success-foreground shadow-sm hover:brightness-95 hover:shadow-md hover:-translate-y-px',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 rounded-md px-3.5 text-[12.5px]',
        lg: 'h-11 rounded-xl px-6 text-[14.5px]',
        xl: 'h-12 rounded-xl px-7 text-[15px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
