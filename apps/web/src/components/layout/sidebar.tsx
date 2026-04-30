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

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
  };

  const sections: NavSection[] = [
    {
      label: 'Refund',
      items: [
        { label: 'Refund Cases', href: '/cases', icon: FileText },
        ...(opsRole
          ? [{ label: 'Refund Pool', href: '/operations', icon: ShieldCheck }]
          : []),
      ],
    },
    {
      label: 'Promo',
      items: [
        { label: 'Promo Admin', href: '/promo', icon: Gift, module: 'promo' },
        { label: 'Send Promo', href: '/promo/allocate', icon: Send, module: 'promo' },
      ],
    },
    {
      label: 'Help Desk',
      items: [
        { label: 'Stores', href: '/help-desk/stores', icon: Store, module: 'stores' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
        { label: 'Notifications', href: '/notifications', icon: Bell },
      ],
    },
    {
      label: 'Admin',
      items: [
        {
          label: 'User Requests',
          href: '/admin/pending-approvals',
          icon: ClipboardList,
          adminOnly: true,
          badge: pendingAccessRequestCount,
        },
      ],
    },
  ];

  const footerItems: NavItem[] = [
    { label: 'Profile', href: '/profile', icon: UserIcon },
    { label: 'Settings', href: '/admin/settings', icon: Settings, adminOnly: true },
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
    <aside className="flex h-full w-[228px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      {/* Brand — single solid icon, no gradient or glow. */}
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-bold tracking-tight text-white">
          W
        </div>
        <span className="truncate text-[13px] font-semibold tracking-tight text-heading">
          WOW Refund
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-surface px-2 text-[12px] text-sidebar-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-3 pb-2">
        {/* Dashboard */}
        <ul className="space-y-px">
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
              <div className="mt-4 mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                {section.label}
              </div>
              <ul className="space-y-px">
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

      <div className="border-t border-sidebar-border px-3 py-2">
        <ul className="space-y-px">
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
              className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] font-medium text-sidebar-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">Sign out</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function SidebarRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  const showBadge = (item.badge ?? 0) > 0;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] font-medium transition-colors',
          isActive
            ? 'bg-sidebar-active-bg text-sidebar-active'
            : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-heading',
        )}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isActive ? 'text-sidebar-active' : 'text-sidebar-muted',
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-medium leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
