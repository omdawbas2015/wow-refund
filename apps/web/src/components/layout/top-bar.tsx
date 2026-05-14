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
    <header className="sticky top-0 z-30 bg-[#170C79] shadow-md">
      <div className="mx-auto flex h-12 w-full max-w-[1440px] items-center gap-3 px-5">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                <span
                  className={
                    isLast
                      ? 'truncate font-semibold text-white'
                      : 'truncate text-white/60'
                  }
                >
                  {c}
                </span>
                {!isLast && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
                )}
              </span>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            className="hidden h-8 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-[12px] text-white/70 transition-all hover:bg-white/20 hover:text-white md:inline-flex"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search...</span>
            <kbd className="kbd ms-2 hidden border-white/20 text-[9.5px] text-white/50 lg:inline-flex">⌘K</kbd>
          </button>

          <NotificationsBell locale={currentLocale} />

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ms-1 flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 py-1 ps-1 pe-3 transition-all hover:bg-white/20"
            title={userEmail}
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-[#170C79]"
            >
              {initial}
            </span>
            <span className="hidden max-w-[140px] truncate text-[12px] font-medium text-white sm:inline">
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
