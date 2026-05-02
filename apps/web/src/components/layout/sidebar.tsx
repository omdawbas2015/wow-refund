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

/**
 * Each nav item gets its own colored icon chip — Asana / Monday / ClickUp
 * style. The colors are derived directly from the brand palette tokens
 * (indigo, teal, peach, mint, butter, sky) so the sidebar feels rich
 * without introducing one-off hex values.
 */
type Tone =
  | 'indigo'
  | 'teal'
  | 'mint'
  | 'peach'
  | 'butter'
  | 'sky'
  | 'rose'
  | 'slate';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  indigo: { bg: '#EEF0FB', fg: '#170C79' },
  teal: { bg: '#D7F0F2', fg: '#0E6E78' },
  mint: { bg: '#DDF2EC', fg: '#1A7864' },
  peach: { bg: '#FCE6D8', fg: '#9C4A1F' },
  butter: { bg: '#FDF1D7', fg: '#8C5C0E' },
  sky: { bg: '#DBEEF6', fg: '#0E6E78' },
  rose: { bg: '#FBE3E6', fg: '#A1142C' },
  slate: { bg: '#EEF1F5', fg: '#3F4A5B' },
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    style?: React.CSSProperties;
  }>;
  tone: Tone;
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
    tone: 'indigo',
  };

  const sections: NavSection[] = [
    {
      label: 'Refund',
      items: [
        { label: 'Refund Cases', href: '/cases', icon: FileText, tone: 'indigo' },
        ...(opsRole
          ? [
              {
                label: 'Refund Pool',
                href: '/operations',
                icon: ShieldCheck,
                tone: 'teal' as Tone,
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
          tone: 'peach',
          module: 'promo',
        },
        {
          label: 'Send Promo',
          href: '/promo/allocate',
          icon: Send,
          tone: 'butter',
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
          tone: 'sky',
          module: 'stores',
        },
        {
          label: 'Branded Solutions',
          href: '/help-desk/branded-solutions',
          icon: Wrench,
          tone: 'mint',
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
          tone: 'teal',
          module: 'reports',
        },
        { label: 'Notifications', href: '/notifications', icon: Bell, tone: 'rose' },
      ],
    },
    {
      label: 'Admin',
      items: [
        {
          label: 'User Requests',
          href: '/admin/pending-approvals',
          icon: ClipboardList,
          tone: 'slate',
          adminOnly: true,
          badge: pendingAccessRequestCount,
        },
      ],
    },
  ];

  const footerItems: NavItem[] = [
    { label: 'Profile', href: '/profile', icon: UserIcon, tone: 'slate' },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      tone: 'slate',
      adminOnly: true,
    },
  ];

  function isActiveHref(href: string) {
    if (href === '/') return pathname === '/' || /^\/(en)$/.test(pathname);
    return pathname.endsWith(href) || pathname.includes(`${href}/`);
  }

  return (
    <aside className="relative flex h-full w-[244px] shrink-0 flex-col bg-white">
      {/* Brand */}
      <Link
        href="/"
        className="flex h-16 items-center gap-3 px-5 transition-opacity hover:opacity-90"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        >
          <Image
            src="/brand/alshaya-mark.png"
            alt="Alshaya Group"
            width={26}
            height={26}
            className="h-[22px] w-[22px] object-contain brightness-0 invert"
            priority
          />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-heading">
            Alshaya
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Operations
          </div>
        </div>
      </Link>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-1 pb-2">
        {/* Dashboard sits alone, no section heading */}
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
              <div className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
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

      <div className="px-3 pb-3 pt-1">
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
              className="group flex h-10 items-center gap-3 rounded-xl px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                <LogOut className="h-3.5 w-3.5 text-neutral-500 transition-colors group-hover:text-foreground" />
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
  const tone = TONE[item.tone];

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'group relative flex h-10 items-center gap-3 rounded-xl px-2 text-[13px] font-medium transition-all',
          isActive
            ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]'
            : 'text-foreground/75 hover:bg-neutral-100 hover:text-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all',
            isActive ? 'shadow-sm' : '',
          )}
          style={{
            backgroundColor: isActive ? 'hsl(var(--primary))' : tone.bg,
          }}
        >
          <Icon
            className="h-4 w-4 transition-colors"
            style={{ color: isActive ? '#FFFFFF' : tone.fg }}
            strokeWidth={2}
          />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {showBadge && (
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-[10px] font-semibold leading-none',
              isActive
                ? 'bg-[hsl(var(--primary))] text-white'
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
