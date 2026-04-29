'use client';

import { signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Globe, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationsBell } from './notifications-bell';

interface TopBarProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

/**
 * Slim top-bar mirroring the Elegance reference: page title on the
 * start, then locale / theme toggles, notifications, and an avatar
 * pill on the end. Search lives inside the sidebar now, so the bar
 * stays uncluttered.
 */
export function TopBar({ userName, userEmail, currentLocale }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  function toggleLocale() {
    const next = currentLocale === 'en' ? 'ar' : 'en';
    let newPath = pathname;
    const prefixMatch = newPath.match(/^\/(en|ar)(\/|$)/);
    if (prefixMatch) {
      newPath = newPath.replace(/^\/(en|ar)/, `/${next}`);
    } else {
      newPath = `/${next}${newPath === '/' ? '' : newPath}`;
    }
    router.push(newPath);
    router.refresh();
  }

  // Derive a friendly title for the current page from its first path
  // segment so the top bar reads "Dashboard" / "Refund Cases" / etc.
  const pageTitle = derivePageTitle(pathname);
  // First-letter avatar — used as a fallback monogram pill on the end
  // of the top bar like the reference dashboard.
  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold tracking-tight text-foreground">
        {pageTitle}
      </h1>
      <div className="ms-auto flex items-center gap-1.5">
        <NotificationsBell locale={currentLocale} />
        <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label="Toggle language">
          <Globe className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div
          className="ms-1 inline-flex items-center gap-2 rounded-full border border-border py-0.5 ps-0.5 pe-2"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          >
            {initial}
          </span>
          <span className="hidden text-xs font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function derivePageTitle(pathname: string): string {
  const stripped = pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
  if (stripped === '/' || stripped === '') return 'Dashboard';
  const segs = stripped.split('/').filter(Boolean);
  // For deep routes, use the top-level segment label so the page name
  // stays short — record IDs etc. don't belong as page titles.
  const top = segs[0] ?? '';
  const map: Record<string, string> = {
    cases: 'Refund Cases',
    operations: 'Refund Pool',
    promo: 'Promo Codes',
    'help-desk': 'Help Desk',
    reports: 'Reports',
    admin: 'Admin',
    profile: 'Profile',
    notifications: 'Notifications',
    customers: 'Customers',
  };
  if (top in map) return map[top]!;
  return top.charAt(0).toUpperCase() + top.slice(1);
}
