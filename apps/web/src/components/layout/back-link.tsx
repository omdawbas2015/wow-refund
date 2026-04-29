'use client';

import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';

/**
 * "Back to …" link rendered above the page content for every interior
 * route. Computes the parent route by trimming the last URL segment and
 * looks up a friendly label from a registry. On the dashboard root and
 * top-level pages with no useful parent the component renders nothing.
 */
export function BackLink() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const locale = useLocale();

  // Strip the locale prefix so the routing hook gets relative paths.
  const stripped = pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
  const segs = stripped.split('/').filter(Boolean);

  // Don't render on the dashboard root or top-level pages — there's
  // nothing meaningful to go back to from there.
  if (segs.length <= 1) return null;

  const parentSegs = segs.slice(0, -1);
  const parentHref = '/' + parentSegs.join('/');

  // Top-level segment determines the friendly label so deep routes
  // still read "Back to Refund Cases" rather than "Back to abc123".
  const top = parentSegs[0] ?? '';
  const labelMap: Record<string, string> = {
    cases: t('refundCases'),
    operations: t('operations'),
    promo: t('promo'),
    'help-desk': t('helpDesk'),
    reports: t('reports'),
    admin: t('admin'),
    profile: t('profile'),
    notifications: t('notifications'),
  };
  const label = labelMap[top] ?? top;

  return (
    <div className="border-b border-border bg-surface px-6 py-2" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Link
        href={parentHref}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        <span>Back to {label}</span>
      </Link>
    </div>
  );
}
