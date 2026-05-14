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
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    style?: React.CSSProperties;
  }>;
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
    <aside className="sidebar-dark relative flex h-full w-[244px] shrink-0 flex-col">
      <Link
        href="/"
        className="flex h-16 items-center gap-3 px-5 transition-opacity hover:opacity-90"
      >
        <Image
          src="/brand/alshaya-mark.png"
          alt="Alshaya Group"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain brightness-0 invert"
          priority
        />
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-white">
            Alshaya
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Operations
          </div>
        </div>
      </Link>

      <nav className="scrollbar-thin flex-1 min-h-0 overflow-y-auto px-3 pt-0.5 pb-1">
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
              <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
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

      <div className="border-t border-white/10 px-3 pb-3 pt-2">
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
              className="group flex h-9 items-center gap-2.5 rounded-lg px-2 text-[12.5px] font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <LogOut className="h-4 w-4" />
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
          'group relative flex h-9 items-center gap-2.5 rounded-lg px-2 text-[12.5px] font-medium transition-all',
          isActive
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/65 hover:bg-white/8 hover:text-white/90',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isActive ? 'text-white' : 'text-white/50 group-hover:text-white/75',
          )}
          strokeWidth={2}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
