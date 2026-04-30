'use client';

import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, Search } from 'lucide-react';
import { NotificationsBell } from './notifications-bell';

interface TopBarProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

export function TopBar({ userName, userEmail, currentLocale }: TopBarProps) {
  const pathname = usePathname();
  const crumbs = deriveCrumbs(pathname);
  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();

  function openSearch() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-surface/80 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/65">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              <span
                className={
                  isLast
                    ? 'truncate font-semibold tracking-tight text-heading'
                    : 'truncate font-medium text-muted-foreground'
                }
              >
                {c}
              </span>
              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={openSearch}
          className="group hidden items-center gap-2 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-[12.5px] text-muted-foreground shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-surface hover:text-foreground hover:shadow-sm md:inline-flex"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
          <span>Quick search</span>
          <kbd className="ml-2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <NotificationsBell locale={currentLocale} />

        <div className="mx-1.5 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="group flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-3 transition-all duration-200 hover:border-border hover:bg-surface-subtle"
          title={userEmail}
        >
          <span
            aria-hidden
            className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
          >
            <span className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-white/30" />
            <span className="relative">{initial}</span>
          </span>
          <span className="hidden text-[13px] font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
          <LogOut className="h-3.5 w-3.5 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-rose-500" />
        </button>
      </div>
    </header>
  );
}

function deriveCrumbs(pathname: string): string[] {
  const stripped = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/';
  if (stripped === '/' || stripped === '') return ['Dashboard'];

  const segs = stripped.split('/').filter(Boolean);
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
    new: 'New',
    allocate: 'Send',
    stores: 'Stores',
    settings: 'Settings',
    'pending-approvals': 'User Requests',
    changelog: 'Changelog',
    search: 'Search',
    'help-desk/stores': 'Stores',
  };

  return segs.map((s) => {
    if (map[s]) return map[s];
    // Looks like an id (uuid / numeric) — show short id.
    if (/^[a-f0-9-]{8,}$/i.test(s) || /^\d+$/.test(s)) return `#${s.slice(0, 8)}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
