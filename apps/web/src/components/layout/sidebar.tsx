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
  ChevronDown,
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
  const t = useTranslations('nav');
  const disabled = new Set(disabledModules);

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
    <aside className="flex h-full w-[272px] shrink-0 flex-col bg-surface border-e border-border/50">
      {/* Brand header */}
      <div className="px-5 pt-6 pb-2">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-all duration-200 hover:bg-surface-subtle"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-inset ring-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/alshaya-mark.png"
              alt="Alshaya"
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
              Alshaya Portal
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Refund Operations
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-border/60 bg-surface-subtle/80 px-3.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-surface hover:border-border hover:shadow-xs"
          aria-label={t('search')}
        >
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <span className="flex-1 text-start text-[13px]">Search...</span>
          <kbd className="rounded-md border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {/* Dashboard */}
        <ul className="mb-2">
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
            <div key={i} className="mb-1">
              <div className="mb-1.5 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
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

      <div className="border-t border-border/40 px-4 py-3">
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
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/5 hover:text-destructive"
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
          'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/8 text-primary shadow-xs'
            : 'text-body hover:bg-surface-subtle hover:text-foreground',
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
        )}
        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground')} />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
