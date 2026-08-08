/**
 * The staff hierarchy, in one place. Pure — no Prisma, no next/headers — so both
 * NextAuth server code and JWT-authenticated /api/v1 routes can use it.
 *
 * Ranks, lowest to highest:
 *   agent < admin < primary admin < superadmin < developer
 *
 * "Primary admin" is NOT a separate `role` string. It is `role: 'admin'` plus
 * `isPrimaryAdmin: true`. Modelling it as a flag means every guard already
 * written as `role === 'admin'` keeps admitting primary admins — a new role
 * string would have silently locked them out of any guard we failed to update,
 * across ~250 call sites.
 */

export type StaffRole = 'agent' | 'admin' | 'superadmin' | 'developer';

export type RoleBearer = {
  role?: string | null;
  isPrimaryAdmin?: boolean | null;
};

const RANK: Record<string, number> = {
  agent: 10,
  admin: 20,
  superadmin: 40,
  developer: 50,
};

/** Primary admins sit between admin and superadmin. */
const PRIMARY_ADMIN_RANK = 30;

export function roleRank(user: RoleBearer | null | undefined): number {
  if (!user?.role) return 0;
  if (user.role === 'admin' && user.isPrimaryAdmin) return PRIMARY_ADMIN_RANK;
  return RANK[user.role] ?? 0;
}

export function isPrimaryAdmin(user: RoleBearer | null | undefined): boolean {
  return user?.role === 'admin' && !!user.isPrimaryAdmin;
}

/** Rank at or above primary admin — the level that may manage other admins. */
export function canManageAdmins(user: RoleBearer | null | undefined): boolean {
  return roleRank(user) >= PRIMARY_ADMIN_RANK;
}

/**
 * Whether `actor` may modify `target`.
 *
 * Strictly greater rank, so peers can never edit each other — two plain admins,
 * or two primary admins, cannot touch one another's accounts. Editing your own
 * account is handled by the profile screens, not here.
 */
export function canManageUser(
  actor: RoleBearer | null | undefined,
  target: RoleBearer | null | undefined,
): boolean {
  return roleRank(actor) > roleRank(target);
}

/** Display label for a role, accounting for the primary-admin flag. */
export function roleLabel(user: RoleBearer | null | undefined): string {
  if (!user?.role) return 'Unknown';
  if (isPrimaryAdmin(user)) return 'Primary Admin';
  switch (user.role) {
    case 'superadmin':
      return 'Super Admin';
    case 'developer':
      return 'Developer';
    case 'admin':
      return 'Admin';
    case 'agent':
      return 'Agent';
    default:
      return user.role;
  }
}
