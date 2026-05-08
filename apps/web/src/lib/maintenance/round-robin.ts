import { prisma } from '@wow/db';

/**
 * Pick the next agent for a maintenance request.
 *
 * Algorithm:
 *  1. Pool = users with `isAvailable = true`, status `ACTIVE`,
 *     not soft-deleted, holding a role that includes the
 *     `maintenance.handle` permission slug — falls back to any
 *     ACTIVE+available user if the perm catalog hasn't been seeded.
 *  2. Order by `lastAutoAssignedAt` ascending, NULLs first (i.e. the
 *     person who hasn't received a fresh ticket the longest).
 *  3. Tie-break by `availableSince` ascending (longer-online wins) and
 *     finally by `id` for determinism.
 *
 * Returns `null` when no available agent exists — the caller should
 * leave the ticket PENDING with `assignedTo = null` and surface a
 * "no available agent" admin warning.
 */
export interface AssignmentPick {
  userId: string;
  reason: string;
}

export async function pickNextAgent(): Promise<AssignmentPick | null> {
  const baseWhere = {
    status: 'ACTIVE' as const,
    deletedAt: null,
    isAvailable: true,
  };

  // First pass: agents whose role includes the `maintenance.handle`
  // permission. Falls through to any ACTIVE+available user if no role
  // claims that permission yet (fresh install / pre-seed state).
  const permCandidate = await prisma.user.findFirst({
    where: {
      ...baseWhere,
      role: {
        permissions: {
          some: { permission: { key: 'maintenance.handle' } },
        },
      },
    },
    orderBy: [
      { lastAutoAssignedAt: 'asc' },
      { availableSince: 'asc' },
      { id: 'asc' },
    ],
    select: { id: true, name: true, lastAutoAssignedAt: true },
  });
  if (permCandidate) {
    return {
      userId: permCandidate.id,
      reason: `Round-robin · ${permCandidate.name} was longest-waiting available agent`,
    };
  }

  // Fallback: any ACTIVE + available user (covers fresh installs where
  // the maintenance.handle permission hasn't been wired into a role).
  const fallback = await prisma.user.findFirst({
    where: baseWhere,
    orderBy: [
      { lastAutoAssignedAt: 'asc' },
      { availableSince: 'asc' },
      { id: 'asc' },
    ],
    select: { id: true, name: true },
  });
  if (!fallback) return null;
  return {
    userId: fallback.id,
    reason: `Round-robin · ${fallback.name} was longest-waiting available agent`,
  };
}

/**
 * Mark a user as having just received an assignment so the next pick
 * skips them. Safe to call inside the same transaction as the request
 * insert.
 */
export async function markAssigned(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastAutoAssignedAt: now },
  });
}
