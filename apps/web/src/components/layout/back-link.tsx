'use client';

import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';

export function BackLink() {
  const pathname = usePathname();

  const stripped = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/';
  const segs = stripped.split('/').filter(Boolean);

  if (segs.length <= 1) return null;

  const parentSegs = segs.slice(0, -1);
  const parentHref = '/' + parentSegs.join('/');

  const top = parentSegs[0] ?? '';
  const labelMap: Record<string, string> = {
    cases: 'Refund Cases',
    operations: 'Refund Pool',
    promo: 'Promo Codes',
    'help-desk': 'Help Desk',
    reports: 'Reports',
    admin: 'Admin',
    profile: 'Profile',
    notifications: 'Notifications',
  };
  const label = labelMap[top] ?? top;

  return (
    <div className="border-b border-border/40 bg-surface/40 py-1.5">
      <div className="mx-auto w-full max-w-[1440px] px-6">
        <Link
          href={parentHref}
          className="group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Back to {label}</span>
        </Link>
      </div>
    </div>
  );
}
