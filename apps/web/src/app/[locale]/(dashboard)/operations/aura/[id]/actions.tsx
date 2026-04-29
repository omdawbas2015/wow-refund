'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AuraLogo } from '@/components/ui/aura-logo';
import {
  sendAuraBatchAction,
  completeAuraBatchAction,
  cancelAuraBatchAction,
} from '@/app/actions/aura-batches';

interface Props {
  batchId: string;
  status: string;
  recipientEmails: string;
}

export function AuraBatchActions(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [responseRawBody, setResponseRawBody] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  function confirmSend() {
    startTransition(async () => {
      const r = await sendAuraBatchAction({ batchId: props.batchId });
      if (r.ok) {
        toast.success('Batch sent');
        setSendDialogOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const r = await completeAuraBatchAction({
        batchId: props.batchId,
        responseRawBody: responseRawBody || undefined,
      });
      if (r.ok) {
        toast.success('Batch completed; cases marked Aura-COMPLETED');
        setResponseRawBody('');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function confirmCancel() {
    if (!cancelReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    startTransition(async () => {
      const r = await cancelAuraBatchAction({
        batchId: props.batchId,
        reason: cancelReason,
      });
      if (r.ok) {
        toast.success('Batch cancelled');
        setCancelReason('');
        setCancelDialogOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <AuraLogo size={20} />
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Recipients: <span className="font-mono text-foreground">{props.recipientEmails}</span>
        </div>

        {props.status === 'DRAFT' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setSendDialogOpen(true)} disabled={pending}>
              <Send className="h-4 w-4" />
              Send to Aura team
            </Button>
          </div>
        ) : null}

        {(props.status === 'SENT' || props.status === 'AWAITING') ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Mark as completed</div>
            <Textarea
              rows={4}
              placeholder="Optional: paste the Aura team's reply for the audit log"
              value={responseRawBody}
              onChange={(e) => setResponseRawBody(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={handleComplete} disabled={pending}>
                {pending ? 'Working…' : 'Complete batch'}
              </Button>
            </div>
          </div>
        ) : null}

        {props.status !== 'COMPLETED' && props.status !== 'CANCELLED' ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Cancel batch</div>
            <Textarea
              rows={2}
              placeholder="Reason (required)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={pending || cancelReason.trim().length < 3}
              >
                Cancel batch
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {/* Send confirmation — replaces the browser confirm() prompt with a
          branded modal showing exactly what will happen and to whom. */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2">
              <AuraLogo size={24} className="ring-1 ring-inset ring-black/10" />
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <DialogTitle>Send batch to the Aura team?</DialogTitle>
            <DialogDescription>
              An email goes out to{' '}
              <span className="font-mono text-foreground">{props.recipientEmails}</span>{' '}
              and the batch flips to <span className="font-medium">SENT</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSendDialogOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmSend} disabled={pending}>
              <Send className="h-4 w-4" />
              {pending ? 'Sending…' : 'Send email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation — same pattern, destructive variant. */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this batch?</DialogTitle>
            <DialogDescription>
              The batch is marked CANCELLED with the reason you entered.
              Cases return to the Aura queue.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-surface-subtle p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Reason</div>
            <div className="mt-0.5 whitespace-pre-wrap break-words">{cancelReason}</div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              disabled={pending}
            >
              Keep batch
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCancel}
              disabled={pending}
            >
              {pending ? 'Working…' : 'Cancel batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
