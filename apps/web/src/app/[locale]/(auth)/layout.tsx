import { type ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('app');

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/[0.03]">
      {/* Ambient gradient — subtle nod to Stripe's gradient meshes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -15%, hsl(var(--primary) / 0.1), transparent 70%), radial-gradient(ellipse 50% 40% at 110% 50%, hsl(var(--primary) / 0.06), transparent 80%)',
        }}
      />

      <div className="flex min-h-screen flex-col">
        <header className="px-6 py-6 sm:px-10">
          <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-medium text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight">{t('name')}</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            {children}
          </div>
        </main>

        <footer className="px-6 py-6 text-center text-xs text-muted-foreground sm:px-10">
          © {new Date().getFullYear()} {t('name')} · {t('tagline')}
        </footer>
      </div>
    </div>
  );
}
