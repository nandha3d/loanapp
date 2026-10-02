import prisma from '@/lib/db';

/** Status given to a branch or agent that exceeds the plan; reversible on upgrade. */
export const PLAN_LOCKED_STATUS = 'plan_locked';

/**
 * Which rows to lock / unlock for a limit. `rows` must already be ordered
 * earliest-created first; the first `max` survive. Pure, so it is unit-tested.
 */
export function planLimitActions<T extends { id: string; status: string }>(
  rows: T[],
  max: number,
): { toLock: string[]; toUnlock: string[] } {
  const keep = new Set(rows.slice(0, max).map((r) => r.id));
  return {
    toLock: rows.filter((r) => !keep.has(r.id) && r.status === 'active').map((r) => r.id),
    toUnlock: rows.filter((r) => keep.has(r.id) && r.status === PLAN_LOCKED_STATUS).map((r) => r.id),
  };
}

/**
 * Brings a tenant's active branches and agents in line with its plan limits.
 *
 * - Over the limit: the earliest-created ones stay active, later ones are set to
 *   `plan_locked` (never deleted — all their history stays).
 * - Under the limit: previously plan-locked ones are re-activated, earliest first,
 *   up to the limit (upgrade path).
 * Owners (superadmins) are never locked, and loans are untouched: existing loans
 * keep running and only NEW ones are refused by `checkLimit`.
 * `maxBranches <= 0` means "no limit", like `checkLimit`.
 */
export async function reconcilePlanLimits(tenantId: string): Promise<{
  lockedBranches: number;
  lockedAgents: number;
  unlockedBranches: number;
  unlockedAgents: number;
}> {
  const result = { lockedBranches: 0, lockedAgents: 0, unlockedBranches: 0, unlockedAgents: 0 };
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { maxBranches: true, maxAgents: true },
  });
  if (!sub) return result;

  if (sub.maxBranches > 0) {
    const branches = await prisma.branch.findMany({
      where: { tenantId, deletedAt: null, status: { in: ['active', PLAN_LOCKED_STATUS] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, status: true },
    });
    const { toLock, toUnlock } = planLimitActions(branches, sub.maxBranches);
    if (toLock.length) {
      await prisma.branch.updateMany({ where: { id: { in: toLock } }, data: { status: PLAN_LOCKED_STATUS } });
    }
    if (toUnlock.length) {
      await prisma.branch.updateMany({ where: { id: { in: toUnlock } }, data: { status: 'active' } });
    }
    result.lockedBranches = toLock.length;
    result.unlockedBranches = toUnlock.length;
  }

  if (sub.maxAgents > 0) {
    const agents = await prisma.user.findMany({
      where: { tenantId, role: 'agent', status: { in: ['active', PLAN_LOCKED_STATUS] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, status: true },
    });
    const { toLock, toUnlock } = planLimitActions(agents, sub.maxAgents);
    if (toLock.length) {
      await prisma.user.updateMany({ where: { id: { in: toLock } }, data: { status: PLAN_LOCKED_STATUS } });
    }
    if (toUnlock.length) {
      await prisma.user.updateMany({ where: { id: { in: toUnlock } }, data: { status: 'active' } });
    }
    result.lockedAgents = toLock.length;
    result.unlockedAgents = toUnlock.length;
  }

  return result;
}
