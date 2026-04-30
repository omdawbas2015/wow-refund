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
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      {/* Brand — navy chip with A monogram. */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl surface-butter text-[18px] font-semibold tracking-tight">
          A
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[15px] font-semibold tracking-tight text-heading">
            Alshaya Refund
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            Operations
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-10 w-full items-center gap-2 rounded-pill border border-sidebar-border bg-surface px-3.5 text-[13px] text-sidebar-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-5 pb-2">
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
              <div className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted">
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
              className="flex h-12 items-center gap-3 rounded-2xl px-3 text-[14px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl chip-rose">
                <LogOut className="h-4 w-4" />
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
          'group flex h-12 items-center gap-3 rounded-2xl px-3 text-[14px] font-medium transition-colors',
          isActive
            ? 'bg-sidebar-hover text-heading'
            : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-heading',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isActive ? 'surface-butter' : CHIP_CLASS[item.tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-neutral-900 px-1.5 text-[11px] font-semibold leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
