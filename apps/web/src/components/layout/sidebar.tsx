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
    <aside className="flex h-full w-[208px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      {/* Brand — centered Alshaya logo, links to dashboard. */}
      <Link href="/" className="flex h-14 items-center justify-center border-b border-sidebar-border transition-opacity hover:opacity-80">
        <Image
          src="/brand/alshaya-group.png"
          alt="Alshaya Group"
          width={120}
          height={60}
          className="h-9 w-auto object-contain"
          priority
        />
      </Link>

      {/* Search */}
      <div className="px-3 pt-0.5">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-8 w-full items-center gap-2 rounded-pill border border-sidebar-border bg-surface px-2.5 text-[11px] text-sidebar-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="kbd text-[9px]">⌘K</kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pt-3 pb-1.5">
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
              <div className="mt-4 mb-1 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
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

      <div className="border-t border-sidebar-border px-2.5 py-2">
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
              className="flex h-8 items-center gap-2.5 rounded-xl px-1.5 text-[11px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg chip-rose">
                <LogOut className="h-3 w-3" />
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
          'group flex h-8 items-center gap-2.5 rounded-xl px-1.5 text-[11px] font-medium transition-colors',
          isActive
            ? 'bg-surface text-heading shadow-xs'
            : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-heading',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
            isActive ? 'surface-butter' : CHIP_CLASS[item.tone],
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-neutral-900 px-1 text-[9px] font-semibold leading-none text-white"
            aria-label={`${item.badge} pending`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
