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
  REJECTED: 1, // rejected at pending-approval
  CANCELLED: -1, // ambient — no step is current
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
 * Vertical case-status stepper for the right rail. The geometry is the
 * same as before (5 steps, ARN execution maps to step 3) but the visual
 * weight is significantly reduced: thin connectors, slim circular nodes,
 * a single accent ring on the current step, and concise labels. A
 * progress percentage above the rail makes "how far along is this case"
 * legible at a glance even before reading individual labels.
 */
export function CaseStatusStepper({
  status,
  locale = 'en',
  className,
  deleted = false,
}: {
  status: CaseStatus;
  locale?: string;
  className?: string;
  deleted?: boolean;
}) {
  const isAr = locale === 'ar';
  const terminal =
    status === 'REJECTED'
      ? 'rejected'
      : status === 'CANCELLED'
        ? 'cancelled'
        : null;
  const partial = status === 'PARTIALLY_REFUNDED';

  // Progress percentage — how many of the 5 steps are visually "done".
  // CANCELLED/REJECTED show 0% since the journey was halted; REFUNDED
  // is 100%; in-flight statuses show the proportional value.
  const stepIdx = STEP_INDEX[status];
  const progressPct =
    deleted || terminal
      ? 0
      : status === 'REFUNDED'
        ? 100
        : stepIdx < 0
          ? 0
          : Math.round((stepIdx / (STEPS.length - 1)) * 100);

  if (deleted) {
    return (
      <div className={cn('rounded-lg border border-border bg-surface-subtle/40 p-4', className)}>
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Trash2 className="h-3 w-3" />
          {isAr ? 'محذوف' : 'Deleted'}
        </div>
        <Rail status={status} locale={locale} dim />
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      {/* Progress header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {isAr ? 'التقدم' : 'Progress'}
        </span>
        <span className="font-mono text-[11px] font-medium tabular-nums text-foreground">
          {progressPct}%
        </span>
      </div>
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            terminal === 'rejected' && 'bg-rose-500/80',
            terminal === 'cancelled' && 'bg-muted-foreground/40',
            !terminal && 'bg-emerald-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Terminal / partial pills */}
      {(terminal || partial) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {terminal === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-400">
              <X className="h-3 w-3" />
              {isAr ? 'مرفوض' : 'Rejected'}
            </span>
          )}
          {terminal === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              <Ban className="h-3 w-3" />
              {isAr ? 'ملغى' : 'Cancelled'}
            </span>
          )}
          {partial && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium text-teal-700 dark:text-teal-400">
              {isAr ? 'استرداد جزئي' : 'Partial'}
            </span>
          )}
        </div>
      )}

      <Rail status={status} locale={locale} terminal={terminal} partial={partial} />
    </div>
  );
}

function Rail({
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
    <ol
      className={cn(
        'relative flex flex-col gap-0',
        dim && 'opacity-50',
      )}
    >
      {STEPS.map((step, idx) => {
        const state = computeState(status, idx);
        const isLast = idx === STEPS.length - 1;
        const next = STEPS[idx + 1];
        const nextState = next ? computeState(status, idx + 1) : null;

        // Connector "done" if this step done AND the next isn't strictly
        // upcoming. Dashed when the case is partially refunded between
        // execution and refunded.
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
            {/* Connector */}
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

            {/* Node — 22 px circle, no offset ring (avoids clipping inside
                tight rails). Current step pulses gently to draw the eye. */}
            <div
              className={cn(
                'relative z-10 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full transition-all duration-300',
                state === 'done' && !isTerminalHere && 'bg-emerald-500 text-white shadow-sm',
                state === 'current' &&
                  !isTerminalHere &&
                  'bg-white text-emerald-600 ring-2 ring-emerald-500 dark:bg-zinc-900',
                state === 'upcoming' && 'border border-border bg-surface text-muted-foreground',
                isTerminalHere &&
                  terminal === 'rejected' &&
                  'bg-rose-500 text-white shadow-sm',
                isTerminalHere &&
                  terminal === 'cancelled' &&
                  'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
              )}
            >
              {state === 'done' && !isTerminalHere && <Check className="h-3 w-3" strokeWidth={3} />}
              {state === 'current' && !isTerminalHere && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              )}
              {isTerminalHere && terminal === 'rejected' && (
                <X className="h-3 w-3" strokeWidth={3} />
              )}
              {isTerminalHere && terminal === 'cancelled' && (
                <Ban className="h-3 w-3" strokeWidth={2.5} />
              )}
            </div>

            {/* Label */}
            <div
              className={cn(
                'text-sm leading-none transition-colors',
                state === 'current' && !isTerminalHere && 'font-semibold text-heading',
                state === 'done' && !isTerminalHere && 'text-foreground',
                state === 'upcoming' && 'text-muted-foreground',
                isTerminalHere && terminal === 'rejected' && 'font-semibold text-rose-700 dark:text-rose-400',
                isTerminalHere &&
                  terminal === 'cancelled' &&
                  'font-semibold text-zinc-700 dark:text-zinc-300',
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
