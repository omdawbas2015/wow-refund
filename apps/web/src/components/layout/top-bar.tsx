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
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-surface px-5">
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
          className="hidden h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:inline-flex"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="kbd ml-1">⌘K</kbd>
        </button>

        <NotificationsBell locale={currentLocale} />

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 transition-colors hover:bg-surface-muted"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10.5px] font-semibold text-white"
          >
            {initial}
          </span>
          <span className="hidden text-[12.5px] font-medium text-foreground sm:inline">
            {userName || userEmail}
          </span>
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
    if (/^[a-f0-9-]{8,}$/i.test(s) || /^\d+$/.test(s)) return `#${s.slice(0, 8)}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
