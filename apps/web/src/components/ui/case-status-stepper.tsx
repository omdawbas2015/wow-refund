'use client';

import { Check, X, Ban, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CaseStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CANCELLED';

const STEPS: { key: CaseStatus; label: string; labelAr: string }[] = [
  { key: 'DRAFT', label: 'Draft', labelAr: 'مسودة' },
  { key: 'PENDING_APPROVAL', label: 'Pending', labelAr: 'قيد الموافقة' },
  { key: 'APPROVED', label: 'Approved', labelAr: 'تمت الموافقة' },
  { key: 'IN_EXECUTION', label: 'Execution', labelAr: 'قيد التنفيذ' },
  { key: 'REFUNDED', label: 'Refunded', labelAr: 'تم الاسترداد' },
];

const STEP_INDEX: Record<CaseStatus, number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  IN_EXECUTION: 3,
  PARTIALLY_REFUNDED: 3,
  REFUNDED: 4,
  REJECTED: 1,
  CANCELLED: -1,
};

type State = 'done' | 'current' | 'upcoming';

function computeState(status: CaseStatus, idx: number): State {
  const cur = STEP_INDEX[status];
  if (status === 'REFUNDED') return 'done';
  if (cur < 0) return 'upcoming';
  if (idx < cur) return 'done';
  if (idx === cur) return 'current';
  return 'upcoming';
}

/**
 * Case-status stepper. Defaults to a horizontal full-width band that sits
 * above the case tabs — clear left-to-right visual journey, easy to scan
 * from any zoom level. The vertical orientation is kept for narrow rails.
 */
export function CaseStatusStepper({
  status,
  locale = 'en',
  className,
  deleted = false,
  orientation = 'horizontal',
}: {
  status: CaseStatus;
  locale?: string;
  className?: string;
  deleted?: boolean;
  orientation?: 'horizontal' | 'vertical';
}) {
  const isAr = locale === 'ar';
  const terminal =
    status === 'REJECTED'
      ? 'rejected'
      : status === 'CANCELLED'
        ? 'cancelled'
        : null;
  const partial = status === 'PARTIALLY_REFUNDED';

  const stepIdx = STEP_INDEX[status];
  const progressPct =
    deleted || terminal
      ? 0
      : status === 'REFUNDED'
        ? 100
        : stepIdx < 0
          ? 0
          : Math.round((stepIdx / (STEPS.length - 1)) * 100);

  const accentColor =
    terminal === 'rejected'
      ? 'rose'
      : terminal === 'cancelled' || deleted
        ? 'zinc'
        : 'emerald';

  if (deleted) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-surface-subtle/40 p-4',
          className,
        )}
      >
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Trash2 className="h-3 w-3" />
          {isAr ? 'محذوف' : 'Deleted'}
        </div>
        {orientation === 'horizontal' ? (
          <HorizontalRail status={status} locale={locale} dim />
        ) : (
          <VerticalRail status={status} locale={locale} dim />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface',
        orientation === 'horizontal' ? 'px-5 py-4' : 'p-4',
        className,
      )}
    >
      {/* Progress header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isAr ? 'التقدم' : 'Progress'}
          </span>
          {(terminal || partial) && (
            <div className="flex flex-wrap gap-1.5">
              {terminal === 'rejected' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                  <X className="h-3 w-3" />
                  {isAr ? 'مرفوض' : 'Rejected'}
                </span>
              )}
              {terminal === 'cancelled' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  <Ban className="h-3 w-3" />
                  {isAr ? 'ملغى' : 'Cancelled'}
                </span>
              )}
              {partial && (
                <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                  {isAr ? 'استرداد جزئي' : 'Partial'}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
          {progressPct}%
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            accentColor === 'rose' && 'bg-rose-500/80',
            accentColor === 'zinc' && 'bg-muted-foreground/40',
            accentColor === 'emerald' && 'bg-emerald-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {orientation === 'horizontal' ? (
        <HorizontalRail status={status} locale={locale} terminal={terminal} partial={partial} />
      ) : (
        <VerticalRail status={status} locale={locale} terminal={terminal} partial={partial} />
      )}
    </div>
  );
}

/* ── Horizontal rail ─────────────────────────────────────────────── */
function HorizontalRail({
  status,
  locale,
  terminal,
  partial,
  dim = false,
}: {
  status: CaseStatus;
  locale: string;
  terminal?: 'rejected' | 'cancelled' | null;
  partial?: boolean;
  dim?: boolean;
}) {
  const isAr = locale === 'ar';
  return (
    <ol className={cn('flex items-start', dim && 'opacity-50')}>
      {STEPS.map((step, idx) => {
        const state = computeState(status, idx);
        const isLast = idx === STEPS.length - 1;
        const next = STEPS[idx + 1];
        const nextState = next ? computeState(status, idx + 1) : null;

        const connectorDone =
          !isLast && state === 'done' && nextState !== 'upcoming';
        const connectorDashed =
          !isLast && partial && step.key === 'IN_EXECUTION';

        const isTerminalHere =
          (terminal === 'rejected' && step.key === 'PENDING_APPROVAL') ||
          (terminal === 'cancelled' && state === 'current');

        const label = isAr ? step.labelAr : step.label;

        return (
          <li
            key={step.key}
            className={cn('relative flex flex-1 items-start', isLast && 'flex-none')}
          >
            <div className="flex flex-col items-center gap-2">
              <Node
                state={state}
                terminal={isTerminalHere ? terminal : null}
              />
              <span
                className={cn(
                  'text-xs leading-none transition-colors',
                  state === 'current' && !isTerminalHere && 'font-semibold text-heading',
                  state === 'done' && !isTerminalHere && 'text-foreground',
                  state === 'upcoming' && 'text-muted-foreground',
                  isTerminalHere && terminal === 'rejected' && 'font-semibold text-rose-700 dark:text-rose-400',
                  isTerminalHere && terminal === 'cancelled' && 'font-semibold text-zinc-700 dark:text-zinc-300',
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'mx-1 mt-[10px] h-[2px] flex-1',
                  connectorDashed
                    ? 'border-t-2 border-dashed border-emerald-500/50'
                    : connectorDone
                      ? 'bg-emerald-500'
                      : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Vertical rail (kept for narrow contexts) ────────────────────── */
function VerticalRail({
  status,
  locale,
  terminal,
  partial,
  dim = false,
}: {
  status: CaseStatus;
  locale: string;
  terminal?: 'rejected' | 'cancelled' | null;
  partial?: boolean;
  dim?: boolean;
}) {
  const isAr = locale === 'ar';
  return (
    <ol className={cn('relative flex flex-col gap-0', dim && 'opacity-50')}>
      {STEPS.map((step, idx) => {
        const state = computeState(status, idx);
        const isLast = idx === STEPS.length - 1;
        const next = STEPS[idx + 1];
        const nextState = next ? computeState(status, idx + 1) : null;

        const connectorDone =
          !isLast && state === 'done' && nextState !== 'upcoming';
        const connectorDashed =
          !isLast && partial && step.key === 'IN_EXECUTION';

        const isTerminalHere =
          (terminal === 'rejected' && step.key === 'PENDING_APPROVAL') ||
          (terminal === 'cancelled' && state === 'current');

        const label = isAr ? step.labelAr : step.label;

        return (
          <li key={step.key} className="relative flex items-center gap-3 py-1.5">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute start-[11px] top-[28px] h-[calc(100%-14px)] w-[2px]',
                  connectorDashed
                    ? 'border-s-2 border-dashed border-emerald-500/50 bg-transparent'
                    : connectorDone
                      ? 'bg-emerald-500'
                      : 'bg-border',
                )}
              />
            )}
            <Node state={state} terminal={isTerminalHere ? terminal : null} />
            <div
              className={cn(
                'text-sm leading-none transition-colors',
                state === 'current' && !isTerminalHere && 'font-semibold text-heading',
                state === 'done' && !isTerminalHere && 'text-foreground',
                state === 'upcoming' && 'text-muted-foreground',
                isTerminalHere && terminal === 'rejected' && 'font-semibold text-rose-700 dark:text-rose-400',
                isTerminalHere && terminal === 'cancelled' && 'font-semibold text-zinc-700 dark:text-zinc-300',
              )}
            >
              {label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Shared 22px circular node. */
function Node({
  state,
  terminal,
}: {
  state: State;
  terminal?: 'rejected' | 'cancelled' | null;
}) {
  return (
    <div
      className={cn(
        'relative z-10 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full transition-all duration-300',
        state === 'done' && !terminal && 'bg-emerald-500 text-white shadow-sm',
        state === 'current' && !terminal && 'bg-white text-emerald-600 ring-2 ring-emerald-500 dark:bg-zinc-900',
        state === 'upcoming' && 'border border-border bg-surface text-muted-foreground',
        terminal === 'rejected' && 'bg-rose-500 text-white shadow-sm',
        terminal === 'cancelled' && 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
      )}
    >
      {state === 'done' && !terminal && <Check className="h-3 w-3" strokeWidth={3} />}
      {state === 'current' && !terminal && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      )}
      {terminal === 'rejected' && <X className="h-3 w-3" strokeWidth={3} />}
      {terminal === 'cancelled' && <Ban className="h-3 w-3" strokeWidth={2.5} />}
    </div>
  );
}
