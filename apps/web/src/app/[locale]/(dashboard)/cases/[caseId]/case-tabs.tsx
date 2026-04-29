'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addCaseNoteAction,
  updateCaseStatusAction,
  deleteCaseAction,
  setComponentArnAction,
  completeRefundAction,
  markCustomerCallAction,
} from '@/app/actions/cases';
import { Button } from '@/components/ui/button';
import { ComponentStatusBadge } from '@/components/ui/case-status-badge';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime, formatMoney, relativeTime } from '@/lib/format';
import {
  User as UserIcon,
  MessageSquare,
  Activity as ActivityIcon,
  Send,
  AtSign,
  CheckCircle2,
  Trash2,
  Ban,
  Mail,
  Phone,
  PhoneOff,
  MoreHorizontal,
} from 'lucide-react';
import { CustomerHistory } from './customer-history';
import { CaseStatusStepper, type CaseStatus } from '@/components/ui/case-status-stepper';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';
import { AuraLogo } from '@/components/ui/aura-logo';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

type CaseData = {
  id: string;
  caseNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerNotes: string | null;
  orderNumber: string;
  orderDate: string;
  orderAmount: number;
  orderCurrency: string;
  totalRefundAmount: number;
  isPartial: boolean;
  auraPoints: number | null;
  auraStatus: string;
  rootCause: string | null;
  rootCauseNotes: string | null;
  brandName: string;
  countryName: string;
  countryFlag: string;
  branchName: string | null;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
  approvedBy: { id: string; name: string; avatarUrl: string | null } | null;
  approvedAt: string | null;
  cancelledReason: string | null;
  customerCallStatus: 'NOT_APPLICABLE' | 'PENDING' | 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED';
  customerCallUpdatedAt: string | null;
};

type Component = {
  id: string;
  paymentMethodKey: string;
  paymentMethodLabel: string;
  amount: number;
  currency: string;
  authCode: string | null;
  arn: string | null;
  status: string;
};

type Note = {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  mentionNames: string[];
};

type Activity = {
  id: string;
  kind: string;
  message: string;
  actorLabel: string | null;
  createdAt: string;
};

type Mentionable = { id: string; name: string; email: string };

const TABS = [
  { key: 'overview', label: 'Overview', icon: UserIcon },
  { key: 'notes', label: 'Notes', icon: MessageSquare },
  { key: 'activity', label: 'Activity', icon: ActivityIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function CaseTabs({
  locale,
  caseData,
  components,
  notes,
  activity,
  mentionableUsers,
  currentUserId,
  canApprove: canUserApprove,
  canExecute: canUserExecute,
  isDeleted = false,
}: {
  locale: string;
  caseData: CaseData;
  components: Component[];
  notes: Note[];
  activity: Activity[];
  mentionableUsers: Mentionable[];
  currentUserId: string;
  canApprove: boolean;
  canExecute: boolean;
  isDeleted?: boolean;
}) {
  const [active, setActive] = useState<TabKey>('overview');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function syncTabFromHash() {
      if (window.location.hash.startsWith('#note-')) {
        setActive('notes');
      }
    }
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (active !== 'notes') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#note-')) return;
    const id = hash.slice(1);
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  function transitionStatus(target: string, reason?: string) {
    startTransition(async () => {
      const result = await updateCaseStatusAction({
        caseId: caseData.id,
        target,
        reason,
      });
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  // Cancel / Delete reason modals — both gate on a typed reason so the
  // audit trail is always meaningful. The kebab menu is the only entry
  // point so neither is one stray click away from a workflow button.
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reasonDraft, setReasonDraft] = useState('');

  function openCancelDialog() {
    setReasonDraft('');
    setCancelDialogOpen(true);
  }

  function openDeleteDialog() {
    setReasonDraft('');
    setDeleteDialogOpen(true);
  }

  function confirmCancel() {
    const reason = reasonDraft.trim();
    if (reason.length < 3) return;
    setCancelDialogOpen(false);
    transitionStatus('CANCELLED', reason);
  }

  function confirmDelete() {
    const reason = reasonDraft.trim();
    if (reason.length < 3) return;
    setDeleteDialogOpen(false);
    startTransition(async () => {
      const result = await deleteCaseAction({ caseId: caseData.id, reason });
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  const canSubmit = !isDeleted && caseData.status === 'DRAFT';
  const isPendingApproval = !isDeleted && caseData.status === 'PENDING_APPROVAL';
  // Execution flow lives inline on the Payment section (per-component ARN
  // entry) rather than a top-bar button. Once every component has an ARN
  // we surface "Send refund email & complete" in the action bar.
  const inExecutionStage =
    !isDeleted &&
    (caseData.status === 'APPROVED' ||
      caseData.status === 'IN_EXECUTION' ||
      caseData.status === 'PARTIALLY_REFUNDED');
  const allComponentsHaveArn =
    components.length > 0 && components.every((c) => !!c.arn?.trim());
  const canCompleteRefund =
    inExecutionStage && canUserExecute && allComponentsHaveArn;
  // Cancel is allowed from any non-terminal status — matches the state
  // machine in @wow/validators. Explicit from the UI so an agent who
  // opened the wrong case can correct themselves without contacting ops.
  const canCancel =
    !isDeleted &&
    caseData.status !== 'REFUNDED' &&
    caseData.status !== 'PARTIALLY_REFUNDED' &&
    caseData.status !== 'REJECTED' &&
    caseData.status !== 'CANCELLED';
  const canDelete = canCancel;

  const showActionBar =
    canSubmit ||
    isPendingApproval ||
    canCompleteRefund ||
    canCancel ||
    canDelete;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-5 lg:order-1 lg:col-start-1">
        {/* Action bar */}
        {showActionBar && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-sm">
            {canSubmit && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => transitionStatus('PENDING_APPROVAL')}
              >
                <Send className="h-4 w-4" />
                Submit for approval
              </Button>
            )}
            {isPendingApproval && canUserApprove && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => transitionStatus('APPROVED')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            )}
            {isPendingApproval && !canUserApprove && (
              <span className="rounded-md bg-surface-subtle/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                Waiting for country manager approval
              </span>
            )}
            {inExecutionStage && !canUserExecute && (
              <span className="rounded-md bg-surface-subtle/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                Awaiting Refund Operations to record ARN
              </span>
            )}
            {canCompleteRefund && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Send the ARN email to the customer and mark this case refunded?',
                    )
                  )
                    return;
                  startTransition(async () => {
                    const result = await completeRefundAction({ caseId: caseData.id });
                    if (result.ok) router.refresh();
                    else alert(result.error);
                  });
                }}
              >
                <Mail className="h-4 w-4" />
                Send ARN email & complete
              </Button>
            )}
            <div className="ms-auto" />
            {(canCancel || canDelete) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="More actions"
                    disabled={isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1">
                  {canCancel && (
                    <button
                      type="button"
                      onClick={openCancelDialog}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-foreground hover:bg-muted"
                    >
                      <Ban className="h-4 w-4 text-muted-foreground" />
                      Cancel case
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={openDeleteDialog}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete case
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Cancel reason dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this case?</DialogTitle>
              <DialogDescription>
                The case stays on file for audit but no refund will be processed. Tell us why so
                the next person reading this knows what happened.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="cancel-reason"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Reason
              </label>
              <Textarea
                id="cancel-reason"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                placeholder="e.g. Created in error — wrong order number"
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCancelDialogOpen(false)}
              >
                Keep case
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={reasonDraft.trim().length < 3 || isPending}
                onClick={confirmCancel}
              >
                <Ban className="h-4 w-4" />
                Cancel case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete reason dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this case?</DialogTitle>
              <DialogDescription>
                The case is soft-deleted and only visible to admins for audit. Tell us why.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="delete-reason"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Reason
              </label>
              <Textarea
                id="delete-reason"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                placeholder="e.g. Duplicate of REF-KW-2026-000007"
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Keep case
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={reasonDraft.trim().length < 3 || isPending}
                onClick={confirmDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {isDeleted && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Trash2 className="h-4 w-4" />
            This case has been deleted. It is read-only and preserved for audit.
          </div>
        )}
        {caseData.status === 'CANCELLED' && !isDeleted && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Ban className="mt-0.5 h-4 w-4 flex-none" />
            <div>
              <div className="font-medium text-foreground">Case cancelled</div>
              {caseData.cancelledReason && (
                <div className="mt-0.5 text-xs">Reason: {caseData.cancelledReason}</div>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.key === 'notes' && notes.length > 0 && (
                  <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-xs">
                    {notes.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {active === 'overview' && (
          <OverviewTab
            caseData={caseData}
            components={components}
            locale={locale}
            canExecute={canUserExecute}
            inExecutionStage={inExecutionStage}
          />
        )}
        {active === 'notes' && (
          <NotesTab
            caseId={caseData.id}
            notes={notes}
            mentionableUsers={mentionableUsers}
            currentUserId={currentUserId}
            isDeleted={isDeleted}
          />
        )}
        {active === 'activity' && <ActivityTab activity={activity} />}
      </div>

      {/* Right rail: vertical status stepper. The stepper renders its
          own "Progress" header + percentage, so we don't double-up the
          label here. */}
      <aside className="lg:order-2 lg:col-start-2">
        <div className="lg:sticky lg:top-24">
          <CaseStatusStepper
            status={caseData.status as CaseStatus}
            locale={locale}
            deleted={isDeleted}
          />
        </div>
      </aside>
    </div>
  );
}

function OverviewTab({
  caseData,
  components,
  locale,
  canExecute,
  inExecutionStage,
}: {
  caseData: CaseData;
  components: Component[];
  locale: string;
  canExecute: boolean;
  inExecutionStage: boolean;
}) {
  // Subtle staggered entry — keeps the page calm but adds motion as
  // sections come into view. Disabled at the user's request via
  // prefers-reduced-motion (handled by `motion-safe:` variant).
  const enter =
    'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300';

  return (
    <div className="space-y-5">
      {/* Summary cards row — focused on the three numbers an operator
          actually needs at a glance: order, refund, refund-of-order
          ratio. Order # / Aura are present in dedicated sections so we
          don't repeat them up top. */}
      <div className={cn('grid gap-3 sm:grid-cols-3', enter)}>
        <SummaryCard
          label="Order amount"
          value={formatMoney(caseData.orderAmount, caseData.orderCurrency)}
          mono
        />
        <SummaryCard
          label="Refund amount"
          value={formatMoney(caseData.totalRefundAmount, caseData.orderCurrency)}
          mono
          highlight
          badge={caseData.isPartial ? 'Partial' : undefined}
        />
        <SummaryCard
          label="% of order"
          value={
            caseData.orderAmount > 0
              ? `${((caseData.totalRefundAmount / caseData.orderAmount) * 100).toFixed(1)}%`
              : '—'
          }
          mono
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          {/* Details — order + customer in a single section so the page
              doesn't fragment six separate identity-sized cards. Phone
              and agent notes are conditional. */}
          <Section title="Details" className={enter}>
            <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
              <FieldInline
                label="Order #"
                value={
                  <CopyableValue
                    value={caseData.orderNumber}
                    label="Copy order #"
                    mono
                  />
                }
              />
              <FieldInline label="Order date" value={formatDate(caseData.orderDate)} />
              <FieldInline
                label="Brand"
                value={`${caseData.countryFlag} ${caseData.brandName}`}
              />
              <FieldInline label="Country" value={caseData.countryName} />
              <FieldInline
                label="Branch"
                value={
                  caseData.branchName ?? <span className="text-muted-foreground">—</span>
                }
              />
              {caseData.customerPhone && (
                <FieldInline
                  label="Phone"
                  value={
                    <CopyableValue
                      value={caseData.customerPhone}
                      label="Copy phone"
                      mono
                    />
                  }
                />
              )}
              {caseData.customerNotes && (
                <div className="sm:col-span-2">
                  <FieldInline label="Agent notes" value={caseData.customerNotes} />
                </div>
              )}
            </dl>
          </Section>

          {/* Payment + per-component ARN entry */}
          <Section title="Payment" className={enter}>
            {components.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No payment components.</div>
            ) : (
              <div className="divide-y divide-border">
                {components.map((c) => (
                  <PaymentComponentRow
                    key={c.id}
                    component={c}
                    caseId={caseData.id}
                    canExecute={canExecute}
                    inExecutionStage={inExecutionStage}
                  />
                ))}
                {caseData.auraPoints ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                    <AuraLogo size={36} className="ring-1 ring-inset ring-black/10" />
                    <div className="font-mono text-sm font-medium">
                      {caseData.auraPoints.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        points
                      </span>
                    </div>
                    <div className="ms-auto">
                      <AuraStatusBadge status={caseData.auraStatus} />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Section>

          {/* Customer call follow-up — persists once the case is
              REFUNDED so the recorded outcome stays on the page just
              like the saved ARN does for the payment row. PENDING
              shows the action buttons; resolved states show what was
              decided + a Change link to re-record. */}
          {(caseData.status === 'REFUNDED' ||
            caseData.status === 'PARTIALLY_REFUNDED') &&
            caseData.customerCallStatus !== 'NOT_APPLICABLE' && (
              <CustomerCallFollowUp
                caseId={caseData.id}
                status={caseData.customerCallStatus}
                updatedAt={caseData.customerCallUpdatedAt}
                locale={locale}
              />
            )}

          {/* Root cause — collapsed to a single inline strip when no
              free-text notes were captured. */}
          {(caseData.rootCause || caseData.rootCauseNotes) && (
            <Section title="Root cause" className={enter}>
              <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
                {caseData.rootCause && (
                  <FieldInline label="Category" value={caseData.rootCause} />
                )}
                {caseData.rootCauseNotes && (
                  <div className="sm:col-span-2">
                    <FieldInline label="Notes" value={caseData.rootCauseNotes} />
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Right column — people + customer history. People is compact:
            dense list with row labels, no avatars per design feedback. */}
        <div className="space-y-5">
          <Section title="People" className={enter}>
            <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-1">
              <PersonRow
                label="Created by"
                user={caseData.createdBy}
                fallback="—"
              />
              <PersonRow
                label="Assigned to"
                user={caseData.assignedTo}
                fallback="Unassigned"
              />
              <PersonRow
                label="Approved by"
                user={caseData.approvedBy}
                fallback="—"
              />
              {caseData.approvedAt && (
                <FieldInline
                  label="Approved at"
                  value={formatDateTime(caseData.approvedAt)}
                />
              )}
            </div>
          </Section>

          <CustomerHistory
            locale={locale}
            customerEmail={caseData.customerEmail}
            excludeCaseId={caseData.id}
          />
        </div>
      </div>
    </div>
  );
}

function NotesTab({
  caseId,
  notes,
  mentionableUsers,
  currentUserId,
  isDeleted = false,
}: {
  caseId: string;
  notes: Note[];
  mentionableUsers: Mentionable[];
  currentUserId: string;
  isDeleted?: boolean;
}) {
  const [body, setBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const mentionedUsers = mentionableUsers.filter((u) => mentionIds.includes(u.id));

  function toggleMention(userId: string) {
    setMentionIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addCaseNoteAction({
        caseId,
        body: body.trim(),
        mentionedUserIds: mentionIds,
      });
      if (result.ok) {
        setBody('');
        setMentionIds([]);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!isDeleted && (
      <form
        onSubmit={submit}
        className="rounded-md border border-border bg-surface p-3 space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[96px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Write a note... use @ to mention teammates"
          maxLength={4000}
        />

        {mentionedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mentionedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                @{u.name}
                <button
                  type="button"
                  onClick={() => toggleMention(u.id)}
                  className="ms-1 text-primary/60 hover:text-primary"
                  aria-label="Remove mention"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPicker((v) => !v)}
            >
              <AtSign className="h-4 w-4" />
              Mention
            </Button>
            {showPicker && (
              <div className="absolute bottom-full start-0 z-10 mb-2 max-h-64 w-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg">
                {mentionableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No active users.</div>
                ) : (
                  mentionableUsers.map((u) => {
                    const selected = mentionIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMention(u.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-sm hover:bg-surface-subtle',
                          selected && 'bg-primary/10 text-primary',
                        )}
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            <Send className="h-4 w-4" />
            {isPending ? 'Posting...' : 'Post note'}
          </Button>
        </div>
      </form>
      )}

      {notes.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notes yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              id={`note-${n.id}`}
              className="rounded-md border border-border bg-surface p-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="font-medium text-foreground">
                  {n.authorName}
                  {n.authorId === currentUserId && (
                    <span className="ms-1 text-muted-foreground">(you)</span>
                  )}
                </div>
                <span className="text-muted-foreground" title={formatDateTime(n.createdAt)}>
                  {relativeTime(n.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              {n.mentionNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>Mentioned:</span>
                  {n.mentionNames.map((m) => (
                    <span key={m} className="text-primary">
                      @{m}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {activity.map((a) => (
        <li key={a.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary/50" />
          <div className="flex-1 rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">{a.kind}</span>
              <span className="text-muted-foreground" title={formatDateTime(a.createdAt)}>
                {relativeTime(a.createdAt)}
              </span>
            </div>
            <div className="mt-1 text-sm">
              {a.actorLabel && <span className="font-medium">{a.actorLabel} </span>}
              <span>{a.message}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Shared UI helpers ── */

function SummaryCard({
  label,
  value,
  mono,
  highlight,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface',
    )}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn('text-lg font-semibold text-heading', mono && 'font-mono')}>
          {value}
        </span>
        {badge && (
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface overflow-hidden',
        className,
      )}
    >
      <div className="border-b border-border bg-surface-subtle/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldInline({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

/**
 * Labeled row for the People sidebar: plain text name (no avatar chip) —
 * keeps the sidebar visually quiet and readable at a glance.
 */
function PersonRow({
  label,
  user,
  fallback,
}: {
  label: string;
  user: { name: string; avatarUrl: string | null } | null;
  fallback: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {user ? (
        <div className="mt-0.5 text-sm font-medium text-foreground">{user.name}</div>
      ) : (
        <div className="mt-0.5 text-sm text-muted-foreground">{fallback}</div>
      )}
    </div>
  );
}

/**
 * Plain text + hover-revealed copy button. Used everywhere a value is
 * a useful identifier ops might paste into another system (email, phone,
 * order #, auth code).
 */
function CopyableValue({
  value,
  label,
  mono,
}: {
  value: string;
  label: string;
  mono?: boolean;
}) {
  return (
    <span className="group inline-flex items-center gap-1">
      <span className={cn('break-all', mono && 'font-mono')}>{value}</span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton value={value} size="xs" label={label} />
      </span>
    </span>
  );
}

/**
 * One row in the Payment section. Shows the brand chip + amount + auth/
 * ARN inline; when the case is in execution and the viewer can execute,
 * exposes an inline ARN form so Refund Operations can stamp the ARN
 * without leaving the page.
 */
function PaymentComponentRow({
  component,
  caseId,
  canExecute,
  inExecutionStage,
}: {
  component: Component;
  caseId: string;
  canExecute: boolean;
  inExecutionStage: boolean;
}) {
  const router = useRouter();
  const [arnDraft, setArnDraft] = useState(component.arn ?? '');
  const [editing, setEditing] = useState(!component.arn);
  const [isPending, startTransition] = useTransition();

  const showInlineForm = inExecutionStage && canExecute && editing;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const arn = arnDraft.trim();
    if (arn.length < 3) {
      alert('Please enter a valid ARN.');
      return;
    }
    startTransition(async () => {
      const result = await setComponentArnAction({
        caseId,
        componentId: component.id,
        arn,
      });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="flex items-center gap-2">
        <PaymentMethodIcons
          methods={[{ key: component.paymentMethodKey, label: component.paymentMethodLabel }]}
          size="sm"
        />
      </div>
      <div className="font-mono text-sm font-medium">
        {formatMoney(component.amount, component.currency)}
      </div>
      {component.authCode && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Auth:{' '}
          <span className="font-mono font-medium text-foreground">{component.authCode}</span>
          <CopyButton value={component.authCode} size="xs" label="Copy auth code" />
        </div>
      )}
      {component.arn && !editing && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          ARN:{' '}
          <span className="font-mono font-medium text-foreground">{component.arn}</span>
          <CopyButton value={component.arn} size="xs" label="Copy ARN" />
          {inExecutionStage && canExecute && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-1 h-6 px-1.5 text-[11px]"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
      )}
      <div className="ms-auto">
        <ComponentStatusBadge status={component.status} />
      </div>
      {showInlineForm && (
        <form
          onSubmit={save}
          className="basis-full space-y-1.5 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3"
        >
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`arn-${component.id}`}>
            Acquirer Reference Number (ARN)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`arn-${component.id}`}
              value={arnDraft}
              onChange={(e) => setArnDraft(e.target.value)}
              placeholder="e.g. 24010120010000000123456"
              className="min-w-[18rem] flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save ARN'}
            </Button>
            {component.arn && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setArnDraft(component.arn ?? '');
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saving will mark this component refunded; the customer is notified once every component
            has an ARN and you click <span className="font-medium">Send ARN email & complete</span>.
          </p>
        </form>
      )}
    </div>
  );
}

/**
 * Persistent follow-up panel shown once the case is REFUNDED. While the
 * call is PENDING the panel offers three outcome buttons; once any
 * outcome is recorded the panel keeps rendering with a labelled summary
 * and a Change action so the recorded decision stays auditable on the
 * page (mirrors how a saved ARN keeps showing on its payment row).
 * NO_ANSWER fires the follow-up reply on the ARN thread server-side.
 */
function CustomerCallFollowUp({
  caseId,
  status,
  updatedAt,
  locale,
}: {
  caseId: string;
  status: 'PENDING' | 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED' | 'NOT_APPLICABLE';
  updatedAt: string | null;
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function record(outcome: 'ANSWERED' | 'NO_ANSWER') {
    startTransition(async () => {
      const result = await markCustomerCallAction({ caseId, outcome });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  const showButtons = status === 'PENDING' || editing;

  if (showButtons) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/5">
        <Phone className="h-4 w-4 flex-none text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0 text-sm text-foreground">
          Confirm refund with customer by phone.
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="success"
            disabled={isPending}
            onClick={() => record('ANSWERED')}
          >
            <Phone className="h-4 w-4" />
            Answered
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => record('NO_ANSWER')}
          >
            <PhoneOff className="h-4 w-4" />
            No answer
          </Button>
          {editing && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Resolved — stays on the page so the decision is auditable.
  const meta: Record<
    'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED',
    {
      tone: string;
      Icon: typeof Phone;
      title: string;
      detail: string;
    }
  > = {
    ANSWERED: {
      tone: 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300',
      Icon: CheckCircle2,
      title: 'Customer answered',
      detail: 'Refund confirmed by phone.',
    },
    NO_ANSWER: {
      tone: 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300',
      Icon: PhoneOff,
      title: 'No answer',
      detail: 'Confirmation email sent to the customer.',
    },
    NOT_NEEDED: {
      tone: 'border-muted bg-surface-subtle text-muted-foreground',
      Icon: Phone,
      title: 'Follow-up skipped',
      detail: 'No call was needed.',
    },
  };
  const m = meta[status as 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED'];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3',
        m.tone,
      )}
    >
      <m.Icon className="h-4 w-4 flex-none" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-foreground">{m.title}</div>
        <div className="text-xs text-muted-foreground">
          {m.detail}
          {updatedAt && (
            <>
              {' · '}
              {new Date(updatedAt).toLocaleString(
                locale === 'ar' ? 'ar-EG' : 'en-US',
                {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                },
              )}
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => setEditing(true)}
        className="text-xs"
      >
        Change
      </Button>
    </div>
  );
}

/**
 * Mirrors the shape of <ComponentStatusBadge> so the Aura row reads the
 * same as a payment component.
 */
function AuraStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    NONE: 'bg-muted text-muted-foreground',
    PENDING:
      'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    COMPLETED:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  };
  const labels: Record<string, string> = {
    NONE: 'No points',
    PENDING: 'Awaiting batch',
    COMPLETED: 'Redeemed',
    FAILED: 'Failed',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        styles[status] ?? styles.NONE,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
