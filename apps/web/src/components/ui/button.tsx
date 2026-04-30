import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Soft, friendly button — rounded-pill shape, single colour-change on
  // hover. No translate, no glow.
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-pill text-[13px] font-medium',
    'transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        // Filled accent — single solid colour, hover deepens it.
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover',
        solid:
          'bg-primary text-primary-foreground hover:bg-primary-hover',
        destructive:
          'bg-destructive text-destructive-foreground hover:brightness-95',
        // Outline — neutral border + subtle hover surface.
        outline:
          'border border-border bg-surface text-foreground hover:bg-surface-subtle',
        secondary:
          'border border-transparent bg-surface-muted text-foreground hover:bg-border',
        ghost:
          'text-foreground hover:bg-surface-muted',
        link:
          'text-primary underline-offset-4 hover:underline',
        success:
          'bg-success text-success-foreground hover:brightness-95',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-[12.5px]',
        lg: 'h-10 px-4 text-[13.5px]',
        xl: 'h-11 px-5 text-[14px]',
        icon: 'h-9 w-9',
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
