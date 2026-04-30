'use client';

import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Search } from 'lucide-react';
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
    <header className="sticky top-0 z-30 bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-6">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              <span
                className={
                  isLast
                    ? 'truncate font-semibold text-heading'
                    : 'truncate text-muted-foreground'
                }
              >
                {c}
              </span>
              {!isLast && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              )}
            </span>
          );
        })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-10 items-center gap-2 rounded-pill border border-border bg-surface px-3.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:inline-flex"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <kbd className="kbd ml-1">⌘K</kbd>
        </button>

        <NotificationsBell locale={currentLocale} />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-3 transition-colors hover:bg-surface-muted"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-pill surface-butter text-[12px] font-semibold"
          >
            {initial}
          </span>
          <span className="hidden text-[13px] font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
        </button>
        </div>
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
    if (/^[a-f0-9-]{8,}$/i.test(s) || /^\d+$/.test(s)) return `#${s.slice(0, 8)}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
