import { prisma } from '@wow/db';

/**
 * Verify the calling user is currently Available. The check reads from
 * the DB (not the JWT session) because availability flips frequently
 * and the session is cached for 8h. Returns the user row when allowed,
 * or `null` when the agent is Away — callers should respond 403.
 */
export async function requireAvailableAgent(
  userId: string,
): Promise<{ id: string; name: string; isAvailable: boolean } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isAvailable: true, status: true, deletedAt: true },
  });
  if (!u) return null;
  if (u.deletedAt || u.status !== 'ACTIVE') return null;
  if (!u.isAvailable) return null;
  return { id: u.id, name: u.name, isAvailable: u.isAvailable };
}
