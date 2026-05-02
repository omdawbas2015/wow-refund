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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
    <aside
      className="flex h-full w-[224px] shrink-0 flex-col border-r border-black/40 text-white/85"
      style={{ backgroundColor: 'hsl(var(--primary-deep))' }}
    >
      {/* Brand — Alshaya mark + name, links to dashboard. */}
      <Link
        href="/"
        className="flex h-16 items-center gap-3 border-b border-white/8 px-5 transition-opacity hover:opacity-90"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/10">
          <Image
            src="/brand/alshaya-mark.png"
            alt="Alshaya Group"
            width={28}
            height={28}
            className="h-6 w-6 object-contain"
            priority
          />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[13.5px] font-semibold tracking-tight text-white">
            Alshaya
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
            Operations
          </div>
        </div>
      </Link>

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
              <div className="mt-5 mb-1.5 px-3 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">
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

      <div className="border-t border-white/8 px-3 py-2.5">
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
              className="group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[12.5px] font-medium text-white/55 transition-colors hover:bg-white/8 hover:text-white"
            >
              <LogOut className="h-4 w-4 shrink-0 text-white/45 transition-colors group-hover:text-white/90" />
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
          'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[12.5px] font-medium transition-all',
          isActive
            ? 'bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'text-white/65 hover:bg-white/6 hover:text-white',
        )}
      >
        {/* Active indicator — vertical teal accent bar on the left edge */}
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all',
            isActive ? 'bg-[hsl(var(--accent))] opacity-100' : 'opacity-0',
          )}
        />
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isActive ? 'text-white' : 'text-white/55 group-hover:text-white/90',
          )}
          strokeWidth={isActive ? 2.25 : 1.75}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className={cn(
              'inline-flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[9.5px] font-semibold leading-none',
              isActive
                ? 'bg-white/20 text-white'
                : 'bg-[hsl(var(--accent))] text-[hsl(var(--primary-deep))]',
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
