'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Gift,
  Store,
  BarChart3,
  ClipboardList,
  Settings,
  Bell,
  User as UserIcon,
  Search as SearchIcon,
  LogOut,
  Send,
} from 'lucide-react';

type ChipTone =
  | 'butter'
  | 'mint'
  | 'lavender'
  | 'peach'
  | 'sky'
  | 'rose';

const CHIP_CLASS: Record<ChipTone, string> = {
  butter: 'chip-butter',
  mint: 'chip-mint',
  lavender: 'chip-lavender',
  peach: 'chip-peach',
  sky: 'chip-sky',
  rose: 'chip-rose',
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: ChipTone;
  adminOnly?: boolean;
  module?: string;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function Sidebar({
  role,
  disabledModules = [],
  pendingAccessRequestCount = 0,
}: {
  role: string | null;
  disabledModules?: string[];
  pendingAccessRequestCount?: number;
}) {
  const pathname = usePathname();
  const disabled = new Set(disabledModules);

  const opsRole =
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'REFUND_AGENT' ||
    role === 'OPERATIONS';

  const dashboardItem: NavItem = {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    tone: 'butter',
  };

  const sections: NavSection[] = [
    {
      label: 'Refund',
      items: [
        { label: 'Refund Cases', href: '/cases', icon: FileText, tone: 'sky' },
        ...(opsRole
          ? [
              {
                label: 'Refund Pool',
                href: '/operations',
                icon: ShieldCheck,
                tone: 'mint' as ChipTone,
              },
            ]
          : []),
      ],
    },
    {
      label: 'Promo',
      items: [
        {
          label: 'Promo Admin',
          href: '/promo',
          icon: Gift,
          tone: 'rose',
          module: 'promo',
        },
        {
          label: 'Send Promo',
          href: '/promo/allocate',
          icon: Send,
          tone: 'lavender',
          module: 'promo',
        },
      ],
    },
    {
      label: 'Help Desk',
      items: [
        {
          label: 'Stores',
          href: '/help-desk/stores',
          icon: Store,
          tone: 'peach',
          module: 'stores',
        },
      ],
    },
    {
      label: 'Reports',
      items: [
        {
          label: 'Reports',
          href: '/reports',
          icon: BarChart3,
          tone: 'mint',
          module: 'reports',
        },
        { label: 'Notifications', href: '/notifications', icon: Bell, tone: 'peach' },
      ],
    },
    {
      label: 'Admin',
      items: [
        {
          label: 'User Requests',
          href: '/admin/pending-approvals',
          icon: ClipboardList,
          tone: 'lavender',
          adminOnly: true,
          badge: pendingAccessRequestCount,
        },
      ],
    },
  ];

  const footerItems: NavItem[] = [
    { label: 'Profile', href: '/profile', icon: UserIcon, tone: 'sky' },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      tone: 'mint',
      adminOnly: true,
    },
  ];

  function isActiveHref(href: string) {
    if (href === '/') return pathname === '/' || /^\/(en)$/.test(pathname);
    return pathname.endsWith(href) || pathname.includes(`${href}/`);
  }

  function openSearch() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  }

  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      {/* Brand — soft yellow chip with W. */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl surface-butter text-[13px] font-bold tracking-tight">
          W
        </div>
        <span className="truncate text-[13.5px] font-semibold tracking-tight text-heading">
          WOW Refund
        </span>
      </div>

      {/* Search */}
      <div className="px-4 pt-1">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-9 w-full items-center gap-2 rounded-pill border border-sidebar-border bg-surface px-3 text-[12px] text-sidebar-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-4 pb-2">
        {/* Dashboard */}
        <ul className="space-y-1">
          <SidebarRow item={dashboardItem} isActive={isActiveHref(dashboardItem.href)} />
        </ul>

        {sections.map((section, i) => {
          const items = section.items.filter(
            (item) =>
              (!item.adminOnly || role === 'ADMIN') &&
              (!item.module || !disabled.has(item.module)),
          );
          if (items.length === 0) return null;
          return (
            <div key={i}>
              <div className="mt-5 mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                {section.label}
              </div>
              <ul className="space-y-1">
                {items.map((item) => (
                  <SidebarRow
                    key={item.href}
                    item={item}
                    isActive={isActiveHref(item.href)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <ul className="space-y-1">
          {footerItems
            .filter((item) => !item.adminOnly || role === 'ADMIN')
            .map((item) => (
              <SidebarRow
                key={item.href}
                item={item}
                isActive={isActiveHref(item.href)}
              />
            ))}
          <li>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/signout"
              className="flex h-10 items-center gap-3 rounded-2xl px-2 text-[12.5px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-xl chip-rose">
                <LogOut className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate">Sign out</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );

  function SidebarRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
    const Icon = item.icon;
    const showBadge = (item.badge ?? 0) > 0;
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            'group flex h-10 items-center gap-3 rounded-2xl px-2 text-[12.5px] font-medium transition-colors',
            isActive
              ? 'bg-surface text-heading shadow-xs'
              : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-heading',
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl',
              isActive ? 'surface-butter' : CHIP_CLASS[item.tone],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 truncate">{item.label}</span>
          {showBadge && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-neutral-900 px-1.5 text-[10px] font-semibold leading-none text-white"
              aria-label={`${item.badge} pending`}
            >
              {item.badge}
            </span>
          )}
        </Link>
      </li>
    );
  }
}
