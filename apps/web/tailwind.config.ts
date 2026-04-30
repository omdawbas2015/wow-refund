import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Stripe-inspired semantic tokens (CSS variables in globals.css)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          subtle: 'hsl(var(--surface-subtle))',
          muted: 'hsl(var(--surface-muted))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          strong: 'hsl(var(--border-strong))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          bg: 'hsl(var(--sidebar-bg))',
          fg: 'hsl(var(--sidebar-fg))',
          muted: 'hsl(var(--sidebar-muted))',
          active: 'hsl(var(--sidebar-active))',
          'active-bg': 'hsl(var(--sidebar-active-bg))',
          hover: 'hsl(var(--sidebar-hover))',
          border: 'hsl(var(--sidebar-border))',
        },
        brand: {
          from: 'hsl(var(--brand-from))',
          via: 'hsl(var(--brand-via))',
          to: 'hsl(var(--brand-to))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
          deep: 'hsl(var(--primary-deep))',
          subtle: 'hsl(var(--primary-subtle))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Text tokens
        heading: 'hsl(var(--heading))',
        label: 'hsl(var(--label))',
        body: 'hsl(var(--body))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Stripe-inspired scale
        'display-xl': ['56px', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '300' }],
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '300' }],
        'display-md': ['36px', { lineHeight: '1.15', letterSpacing: '-0.014em', fontWeight: '300' }],
        'display-sm': ['28px', { lineHeight: '1.2', letterSpacing: '-0.012em', fontWeight: '400' }],
        'heading-lg': ['24px', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '500' }],
        'heading-md': ['18px', { lineHeight: '1.3', fontWeight: '500' }],
        'heading-sm': ['15px', { lineHeight: '1.35', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.3', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        // World-class soft shadow system — feathered, never harsh
        'xs': '0 1px 1px rgba(15, 23, 42, 0.04)',
        'sm': '0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 1px rgba(15, 23, 42, 0.03)',
        DEFAULT: '0 2px 6px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'md': '0 4px 12px rgba(15, 23, 42, 0.07), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'lg': '0 12px 28px rgba(15, 23, 42, 0.08), 0 4px 8px rgba(15, 23, 42, 0.04)',
        'xl': '0 24px 56px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.05)',
        '2xl': '0 36px 80px rgba(15, 23, 42, 0.16), 0 12px 24px rgba(15, 23, 42, 0.06)',
        'glow': '0 0 0 1px hsl(var(--primary) / 0.10), 0 8px 24px hsl(var(--primary) / 0.18)',
        'glow-strong': '0 0 0 1px hsl(var(--primary) / 0.16), 0 14px 40px hsl(var(--primary) / 0.28)',
        'focus': '0 0 0 3px hsl(var(--ring) / 0.25)',
        'inner': 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 6px 18px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06)',
        'brand-glow': '0 8px 24px hsl(var(--brand-via) / 0.25), 0 2px 8px hsl(var(--brand-from) / 0.15)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, hsl(var(--brand-from)) 0%, hsl(var(--brand-via)) 55%, hsl(var(--brand-to)) 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, hsl(var(--brand-from) / 0.12) 0%, hsl(var(--brand-via) / 0.10) 55%, hsl(var(--brand-to) / 0.10) 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 4px hsl(var(--primary) / 0.15)' },
          '50%': { boxShadow: '0 0 0 6px hsl(var(--primary) / 0.25)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 300ms ease-out',
        'fade-in-up': 'fade-in-up 400ms ease-out',
        'slide-in-from-top': 'slide-in-from-top 250ms ease-out',
        'slide-in-from-right': 'slide-in-from-right 300ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'count-up': 'count-up 500ms ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
