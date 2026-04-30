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
        // Tight, functional scale — no display-300 light weights.
        'display-lg': ['26px', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-md': ['22px', { lineHeight: '1.2', letterSpacing: '-0.018em', fontWeight: '600' }],
        'display-sm': ['18px', { lineHeight: '1.25', letterSpacing: '-0.014em', fontWeight: '600' }],
        'heading-lg': ['16px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['14px', { lineHeight: '1.35', fontWeight: '600' }],
        'heading-sm': ['12px', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg': ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-md': ['13px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['10.5px', { lineHeight: '1.3', letterSpacing: '0.04em', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
        pill: '9999px',
      },
      boxShadow: {
        // Restrained, functional shadows — no glow, no brand-tinted shadows.
        'xs': '0 1px 1px rgba(15, 23, 42, 0.04)',
        'sm': '0 1px 2px rgba(15, 23, 42, 0.05)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'md': '0 4px 10px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'lg': '0 10px 24px rgba(15, 23, 42, 0.08), 0 3px 6px rgba(15, 23, 42, 0.04)',
        'xl': '0 20px 40px rgba(15, 23, 42, 0.10), 0 6px 12px rgba(15, 23, 42, 0.05)',
        'focus': '0 0 0 3px hsl(var(--ring) / 0.18)',
        'inner': 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
        // Single hairline border + tiny lift — used by Card.
        'card': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 2px 6px rgba(15, 23, 42, 0.07)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
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
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.18s ease-out',
        'accordion-up': 'accordion-up 0.18s ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 240ms ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
