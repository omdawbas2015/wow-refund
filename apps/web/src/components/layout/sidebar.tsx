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
  Sparkles,
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
        {
          label: 'Stores',
          href: '/help-desk/stores',
          icon: Store,
          module: 'stores',
        },
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
    <aside className="relative flex h-full w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      {/* subtle aurora wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 40% at 0% 0%, hsl(var(--brand-from) / 0.08), transparent 60%), radial-gradient(ellipse 60% 30% at 100% 0%, hsl(var(--brand-to) / 0.06), transparent 55%)',
        }}
      />

      <div className="relative flex h-full flex-col">
        {/* Brand */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-brand-glow ring-1 ring-white/40">
              <Sparkles className="h-4 w-4 text-white drop-shadow-sm" />
              <span className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[14px] font-semibold tracking-tight text-heading">
                WOW Refund
              </span>
              <span className="block truncate text-[11px] text-sidebar-muted">
                Refund operations
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <button
            type="button"
            onClick={openSearch}
            className="group flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-surface px-2.5 text-[12.5px] text-sidebar-muted shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-surface hover:text-foreground hover:shadow-sm"
            aria-label="Search"
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0 transition-colors group-hover:text-primary" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-sidebar-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-2 pb-2">
          {/* Dashboard */}
          <ul className="mb-1">
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
              <div key={i} className="mb-0.5">
                <div className="mt-4 mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70">
                  {section.label}
                </div>
                <ul className="space-y-0.5">
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

        <div className="border-t border-sidebar-border px-3 py-2.5">
          <ul className="space-y-0.5">
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
                className="group flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-sidebar-muted transition-all duration-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
                <span className="flex-1 truncate">Sign out</span>
              </a>
            </li>
          </ul>
        </div>
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
          'group relative flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-sidebar-active-bg text-primary shadow-sm'
            : 'text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-heading',
        )}
      >
        {isActive && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
          />
        )}
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-all duration-200',
            isActive
              ? 'text-primary'
              : 'text-sidebar-muted group-hover:text-heading group-hover:scale-105',
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
