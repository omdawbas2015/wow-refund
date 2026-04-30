'use client';

import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { NotificationsBell } from './notifications-bell';

interface TopBarProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

export function TopBar({ userName, userEmail, currentLocale }: TopBarProps) {
  const pathname = usePathname();
  const pageTitle = derivePageTitle(pathname);
  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border/30 bg-white/70 backdrop-blur-xl px-6">
      <h1 className="text-sm font-semibold tracking-tight text-foreground">
        {pageTitle}
      </h1>
      <div className="ml-auto flex items-center gap-1.5">
        <NotificationsBell locale={currentLocale} />
        <div className="mx-1.5 h-5 w-px bg-border/30" />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="group flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-all duration-200 hover:bg-muted/60"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-bold text-white shadow-sm"
          >
            {initial}
          </span>
          <span className="hidden text-[13px] font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
          <LogOut className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        </button>
      </div>
    </header>
  );
}

function derivePageTitle(pathname: string): string {
  const stripped = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/';
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
