'use client';

import Image from 'next/image';
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
  LogOut,
  Send,
  Wrench,
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
          ? [
              {
                label: 'Refund Pool',
                href: '/operations',
                icon: ShieldCheck,
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
          module: 'promo',
        },
        {
          label: 'Send Promo',
          href: '/promo/allocate',
          icon: Send,
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
          module: 'stores',
        },
        {
          label: 'Branded Solutions',
          href: '/help-desk/branded-solutions',
          icon: Wrench,
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
          module: 'reports',
        },
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
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      adminOnly: true,
    },
  ];

  function isActiveHref(href: string) {
    if (href === '/') return pathname === '/' || /^\/(en)$/.test(pathname);
    return pathname.endsWith(href) || pathname.includes(`${href}/`);
  }

  return (
    <aside className="flex h-full w-[208px] shrink-0 flex-col border-r border-sidebar-border bg-[hsl(var(--accent-cream))] text-sidebar-fg">
      {/* Brand — Alshaya mark + name, links to dashboard. */}
      <Link
        href="/"
        className="flex h-14 items-center gap-2.5 px-4 transition-opacity hover:opacity-90"
      >
        <Image
          src="/brand/alshaya-mark.png"
          alt="Alshaya Group"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
          priority
        />
        <span className="text-[13px] font-semibold tracking-tight text-heading">
          Alshaya
        </span>
      </Link>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pt-1 pb-2">
        {/* Dashboard */}
        <ul className="space-y-0.5">
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
              <div className="mt-4 mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--primary))/0.55] opacity-60">
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

      <div className="px-2.5 py-2">
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
              className="flex h-8 items-center gap-2 rounded-xl px-2 text-[11.5px] font-medium text-sidebar-muted transition-colors hover:bg-white/60 hover:text-heading"
            >
              <span className="flex h-5 w-5 items-center justify-center text-sidebar-muted">
                <LogOut className="h-3.5 w-3.5" />
              </span>
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
          'group relative flex h-8 items-center gap-2.5 rounded-xl px-2 text-[12px] font-medium transition-all',
          isActive
            ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
            : 'text-[hsl(var(--neutral-700))] hover:bg-white/70 hover:text-heading',
        )}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-colors',
            isActive ? 'text-white' : 'text-[hsl(var(--neutral-500))]',
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className={cn(
              'inline-flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[9.5px] font-semibold leading-none',
              isActive
                ? 'bg-white/20 text-white'
                : 'bg-destructive text-destructive-foreground',
            )}
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
