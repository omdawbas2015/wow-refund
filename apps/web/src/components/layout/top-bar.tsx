'use client';

import { signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Globe } from 'lucide-react';
import { NotificationsBell } from './notifications-bell';

interface TopBarProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

export function TopBar({ userName, userEmail, currentLocale }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();

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

  const pageTitle = derivePageTitle(pathname);
  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border/40 bg-surface/80 backdrop-blur-sm px-8">
      <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
        {pageTitle}
      </h1>
      <div className="ms-auto flex items-center gap-2">
        <NotificationsBell locale={currentLocale} />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLocale}
          aria-label="Toggle language"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border/40" />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="group flex items-center gap-2.5 rounded-full border border-border/50 py-1 ps-1 pe-3 transition-all duration-200 hover:border-border hover:shadow-xs"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-xs font-bold text-primary"
          >
            {initial}
          </span>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
          <LogOut className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
        </button>
      </div>
    </header>
  );
}

function derivePageTitle(pathname: string): string {
  const stripped = pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
  if (stripped === '/' || stripped === '') return 'Dashboard';
  const segs = stripped.split('/').filter(Boolean);
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
