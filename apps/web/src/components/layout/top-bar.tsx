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
    <header className="sticky top-0 z-30 border-b border-border/40 bg-white shadow-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-6">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    isLast
                      ? 'truncate text-[15px] font-semibold text-[#170C79]'
                      : 'truncate font-medium text-neutral-400'
                  }
                >
                  {c}
                </span>
                {!isLast && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                )}
              </span>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <button
            type="button"
            onClick={openSearch}
            className="hidden h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 text-[13px] text-neutral-500 transition-all hover:border-neutral-300 hover:bg-white hover:shadow-sm md:inline-flex"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search...</span>
            <kbd className="kbd ms-3 hidden text-[10px] lg:inline-flex">⌘K</kbd>
          </button>

          <NotificationsBell locale={currentLocale} />

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ms-1 flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white py-1.5 ps-1.5 pe-3.5 transition-all hover:border-neutral-300 hover:shadow-sm"
            title={userEmail}
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#170C79] text-[11px] font-semibold text-white"
            >
              {initial}
            </span>
            <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-neutral-700 sm:inline">
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
    'branded-solutions': 'Branded Solutions',
    'maintenance-supervisors': 'Maintenance Supervisors',
  };

  return segs.map((s) => {
    if (map[s]) return map[s];
    if (/^[a-f0-9-]{8,}$/i.test(s) || /^\d+$/.test(s)) return `#${s.slice(0, 8)}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
