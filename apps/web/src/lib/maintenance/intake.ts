import { prisma } from '@wow/db';
import { generateTicketRef } from './ticket-ref';
import { markAssigned, pickNextAgent } from './round-robin';
import { broadcast } from '@/lib/events/bus';
import { dispatchNotifications } from '@/lib/notifications/dispatch';

/**
 * Shape of the payload Power Automate forwards to us when the
 * Microsoft Form is submitted. Field names mirror the form labels;
 * extra unknown keys are preserved verbatim in `rawPayload`.
 */
export interface MaintenanceIntakePayload {
  countryName: string;
  cityName?: string | null;
  customerName: string;
  storeName: string;
  location?: string | null;
  submitterName: string;
  contactNumber: string;
  email: string;
  machineModel: string;
  issueType: string;
  powerAutomateRunId?: string | null;
  source?: string;
  raw?: unknown;
}

export interface MaintenanceIntakeResult {
  id: string;
  ticketRef: string;
  status: 'PENDING' | 'IN_PROGRESS';
  assignedTo: { id: string; name: string } | null;
  assignmentReason: string | null;
}

/**
 * Persist a freshly-arrived maintenance request, run round-robin to
 * pick the next available agent, write a status-history row, fan out
 * SSE/notification events, and return a thin summary the webhook can
 * echo back to Power Automate. Safe to call from a webhook OR a manual
 * "create test ticket" admin button.
 */
export async function ingestMaintenanceRequest(
  payload: MaintenanceIntakePayload,
): Promise<MaintenanceIntakeResult> {
  // Strip empty strings down to null so the table doesn't show
  // confusing whitespace where the customer left a blank.
  const norm = (v: string | null | undefined): string | null => {
    if (v == null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  };

  // Decide assignment up-front so we can save the resolved state in a
  // single insert; if no agent is available the ticket sits PENDING in
  // the pool and the next "Available" toggle pulls it via the pool API.
  const pick = await pickNextAgent();

  // Generate a unique ticket ref. On rare collision (race) bump and
  // retry once — the @unique constraint guards correctness either way.
  let ticketRef = await generateTicketRef();
  let request = null as Awaited<ReturnType<typeof prisma.maintenanceRequest.create>> | null;
  for (let attempt = 0; attempt < 3 && !request; attempt += 1) {
    try {
      request = await prisma.maintenanceRequest.create({
        data: {
          ticketRef,
          countryName: payload.countryName.trim(),
          cityName: norm(payload.cityName),
          customerName: payload.customerName.trim(),
          storeName: payload.storeName.trim(),
          location: norm(payload.location),
          submitterName: payload.submitterName.trim(),
          contactNumber: payload.contactNumber.trim(),
          email: payload.email.trim(),
          machineModel: payload.machineModel.trim(),
          issueType: payload.issueType.trim(),
          rawPayload: payload.raw ? JSON.stringify(payload.raw) : null,
          powerAutomateRunId: payload.powerAutomateRunId ?? null,
          source: payload.source ?? 'MS_FORM',
          status: pick ? 'IN_PROGRESS' : 'PENDING',
          assignedToId: pick?.userId ?? null,
          assignedAt: pick ? new Date() : null,
          assignmentReason: pick?.reason ?? null,
        },
      });
    } catch (err) {
      // Treat unique-violation on ticketRef as a race condition and
      // bump the suffix; rethrow anything else.
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        ticketRef = await generateTicketRef();
        continue;
      }
      throw err;
    }
  }
  if (!request) {
    throw new Error('Failed to allocate ticketRef after 3 attempts');
  }

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: request.id,
      fromStatus: null,
      toStatus: request.status,
      action: pick ? 'CREATED_AND_ASSIGNED' : 'CREATED',
      note: pick?.reason ?? 'No available agent — ticket pending in pool.',
      actorId: pick?.userId ?? null,
    },
  });

  let assignedSummary: MaintenanceIntakeResult['assignedTo'] = null;
  if (pick) {
    await markAssigned(pick.userId);
    const u = await prisma.user.findUnique({
      where: { id: pick.userId },
      select: { id: true, name: true },
    });
    if (u) assignedSummary = u;
    // Personal in-app notification + bell badge.
    await dispatchNotifications({
      userIds: [pick.userId],
      type: 'MAINT_REQUEST_ASSIGNED',
      title: `New maintenance request assigned: ${request.ticketRef}`,
      body: `${request.customerName} · ${request.storeName} · ${request.machineModel}`,
      href: `/help-desk/branded-solutions/${request.id}`,
      contextType: 'MAINT',
      contextId: request.id,
    });
  }

  // Pool broadcast — every open viewer of the pool list gets a live
  // refresh hint, regardless of who the ticket was assigned to.
  broadcast({
    type: 'maintenance.created',
    data: {
      id: request.id,
      ticketRef: request.ticketRef,
      status: request.status,
      assignedToId: request.assignedToId,
    },
  });

  return {
    id: request.id,
    ticketRef: request.ticketRef,
    status: request.status as 'PENDING' | 'IN_PROGRESS',
    assignedTo: assignedSummary,
    assignmentReason: request.assignmentReason,
  };
}
