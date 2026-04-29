'use client';

import { useTranslations } from 'next-intl';
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
  ChevronRight,
  Search as SearchIcon,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  module?: string;
  /** Numeric badge shown on the right of the row (e.g. pending count). */
  badge?: number;
}

interface NavSection {
  /** UPPERCASE caption shown above the section, like the Elegance ref. */
  label: string;
  items: NavItem[];
}

/**
 * Primary navigation rail. Layout follows the Elegance reference the
 * owner shared:
 *
 *   - workspace block at the top (logo + name + chevron)
 *   - search input that opens the global command palette
 *   - top-level "Dashboard" row
 *   - section captions ("REFUND", "ANALYTICS", "ADMIN") with their
 *     items underneath
 *   - footer block at the bottom for Settings + Sign out
 */
export function Sidebar({
  role,
  disabledModules = [],
  pendingAccessRequestCount = 0,
}: {
  role: string | null;
  disabledModules?: string[];
  /** Number of users awaiting access approval. Drives the dot/badge on
   *  the User Access Requests row so admins know there's work waiting. */
  pendingAccessRequestCount?: number;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const disabled = new Set(disabledModules);

  // Refund Pool is for whoever actually executes refunds. The seeded role
  // for that work is REFUND_AGENT (DB) — the older 'OPERATIONS' string is
  // kept as a legacy alias because some env data may still hold it.
  const opsRole =
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'REFUND_AGENT' ||
    role === 'OPERATIONS';

  const dashboardItem: NavItem = {
    label: t('dashboard'),
    href: '/',
    icon: LayoutDashboard,
  };

  const sections: NavSection[] = [
    {
      label: t('refund'),
      items: [
        { label: t('refundCases'), href: '/cases', icon: FileText },
        ...(opsRole
          ? [{ label: t('operations'), href: '/operations', icon: ShieldCheck }]
          : []),
        { label: t('promo'), href: '/promo', icon: Gift, module: 'promo' },
      ],
    },
    {
      label: t('helpDesk'),
      items: [
        {
          label: t('storesCommunication'),
          href: '/help-desk/stores',
          icon: Store,
          module: 'stores',
        },
      ],
    },
    {
      label: t('reports'),
      items: [
        { label: t('reports'), href: '/reports', icon: BarChart3, module: 'reports' },
        { label: t('notifications'), href: '/notifications', icon: Bell },
      ],
    },
    // Admin sidebar is intentionally minimal: only items an admin touches
    // every day belong here. Everything else (users, brands, branches,
    // workflow rules, templates, cron, modules, system info, etc.) lives
    // inside /admin/settings as a grouped hub.
    {
      label: t('admin'),
      items: [
        {
          label: t('pendingApprovals'),
          href: '/admin/pending-approvals',
          icon: ClipboardList,
          adminOnly: true,
          badge: pendingAccessRequestCount,
        },
      ],
    },
  ];

  // Footer items live in their own block below the scrollable nav, like
  // Settings + Logout in the Elegance reference.
  const footerItems: NavItem[] = [
    { label: t('profile'), href: '/profile', icon: UserIcon },
    { label: t('settings'), href: '/admin/settings', icon: Settings, adminOnly: true },
  ];

  function isActiveHref(href: string) {
    if (href === '/') return pathname === '/' || /^\/(en|ar)$/.test(pathname);
    return pathname.endsWith(href) || pathname.includes(`${href}/`);
  }

  function openSearch() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-border bg-surface">
      {/* Workspace header — square brand tile + name + chevron, mirrors
          the Elegance "E" / Elegance Essense block. */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <span className="text-sm font-bold leading-none">W</span>
        </div>
        <span className="flex-1 truncate text-sm font-semibold tracking-tight">
          WOW Refund
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
      </div>

      {/* Sidebar search — opens the global command palette. */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-subtle px-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          aria-label={t('search')}
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-start text-[13px]">Search</span>
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-1 pb-2">
        {/* Dashboard row sits above the sectioned nav. */}
        <ul className="mb-3 space-y-0.5">
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
            <div key={i} className="mb-4">
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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

      <div className="border-t border-border px-3 py-2">
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
            <a
              href="/api/auth/signout"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-body transition-colors hover:bg-surface-subtle hover:text-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{t('logout')}</span>
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
          'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-body hover:bg-surface-subtle hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge ? (
          <span
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
        )}
      </Link>
    </li>
  );
}
