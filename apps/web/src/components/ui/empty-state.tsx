import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared "no rows / no data yet" placeholder. The pattern was inlined
 * across ~10 admin list pages with slightly different copy and class
 * lists. This component standardizes on the muted-foreground centered
 * cell that those pages converged on, so future list pages get
 * consistent typography and spacing without re-deriving it each time.
 *
 * Usage from a `<tbody>` row:
 *
 *   <tr>
 *     <td colSpan={6}>
 *       <EmptyState
 *         title="No emails sent yet."
 *         description="Outbound notifications will appear here once the first batch fires."
 *       />
 *     </td>
 *   </tr>
 *
 * The component renders inert copy by default; pass `action` to embed
 * a primary CTA (e.g. a "New report" button) below the description.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary message; rendered as a paragraph in heading color. */
  title: React.ReactNode;
  /** Optional secondary copy in muted color. */
  description?: React.ReactNode;
  /** Optional CTA element rendered under the description. */
  action?: React.ReactNode;
  /** Optional decorative leading icon (rendered above the title). */
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
      {...rest}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-heading">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
