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

  const sections: NavSection[] = [
    {
      label: '',
      items: [
        { label: t('dashboard'), href: '/', icon: LayoutDashboard },
        { label: t('notifications'), href: '/notifications', icon: Bell },
      ],
    },
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
      ],
    },
    // Admin sidebar is intentionally minimal: only items an admin touches
    // every day belong here. Everything else (users, brands, branches,
    // workflow rules, templates, cron, modules, system info, etc.) lives
    // inside /admin/settings as a grouped hub. The hub stays one click
    // away while the daily flow stays uncluttered.
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
        { label: t('settings'), href: '/admin/settings', icon: Settings, adminOnly: true },
      ],
    },
  ];

  // Profile + sign-out style controls live at the bottom of the rail —
  // they don't belong next to operational nav.
  const footerItems: NavItem[] = [
    { label: t('profile'), href: '/profile', icon: UserIcon },
  ];

  function isActiveHref(href: string) {
    if (href === '/') return pathname === '/' || /^\/(en|ar)$/.test(pathname);
    return pathname.endsWith(href) || pathname.includes(`${href}/`);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight">WOW Refund</span>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => {
          const items = section.items.filter(
            (item) =>
              (!item.adminOnly || role === 'ADMIN') &&
              (!item.module || !disabled.has(item.module)),
          );
          if (items.length === 0) return null;
          return (
            <div key={i} className="mb-4">
              {section.label ? (
                <div className="mb-1 px-2 text-caption uppercase text-muted-foreground">
                  {section.label}
                </div>
              ) : null}
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
          {footerItems.map((item) => (
            <SidebarRow
              key={item.href}
              item={item}
              isActive={isActiveHref(item.href)}
            />
          ))}
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
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
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
        ) : null}
      </Link>
    </li>
  );
}
