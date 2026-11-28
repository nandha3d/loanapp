export class ChitPlanLimitError extends Error {
  readonly code = 'CHIT_PLAN_LIMIT_REACHED';
  readonly statusCode = 402;
  readonly activeCount: number;
  readonly maxActiveChitGroups: number;

  constructor(activeCount: number, maxActiveChitGroups: number, message?: string) {
    super(
      message ||
        `Your current plan allows ${maxActiveChitGroups} concurrent active chit group(s) (currently ${activeCount} active). Upgrade your plan to activate another chit group.`,
    );
    this.name = 'ChitPlanLimitError';
    this.activeCount = activeCount;
    this.maxActiveChitGroups = maxActiveChitGroups;
  }
}

export interface ChitPlanQuotaResolution {
  plan: string;
  maxActiveChitGroups: number | null;
  maxMembersPerChit: number | null;
  canExportStatutoryRegisters: boolean;
}

/**
 * Pure entitlement resolver decoupling Chit Fund quotas from `maxActiveLoans`:
 * - Free (Rs.0) plan: maxActiveChitGroups = 1, maxMembersPerChit = null (unlimited members)
 * - Paid plans: configured catalog/subscription limits or unlimited active chit groups
 * - Completed / Closed / Draft chits never consume an active slot
 */
export function resolveChitPlanQuotas(sub: {
  plan?: string | null;
  monthlyPrice?: number | null;
  maxActiveChitGroups?: number | null;
  maxMembersPerChit?: number | null;
  statutoryRegistersEnabled?: boolean | null;
  grandfatheredFeatures?: string | null;
}): ChitPlanQuotaResolution {
  const plan = String(sub?.plan || 'free').toLowerCase();
  // Only treat an actual 'free' plan as free tier; lifetime/enterprise/custom
  // plans may carry monthlyPrice === 0 and must retain their tier entitlements.
  const isFree = plan === 'free';
  const isEnterprise = plan === 'enterprise' || plan === 'lifetime';

  const maxActiveChitGroups =
    sub?.maxActiveChitGroups != null
      ? sub.maxActiveChitGroups > 0
        ? sub.maxActiveChitGroups
        : null
      : isFree
        ? 1
        : null;

  const maxMembersPerChit =
    sub?.maxMembersPerChit != null && sub.maxMembersPerChit > 0
      ? sub.maxMembersPerChit
      : null;

  const canExportStatutoryRegisters = Boolean(sub?.statutoryRegistersEnabled) || isEnterprise;

  return {
    plan,
    maxActiveChitGroups,
    maxMembersPerChit,
    canExportStatutoryRegisters,
  };
}

export async function getChitPlanEntitlements(db: any, tenantId: string): Promise<ChitPlanQuotaResolution> {
  if (!tenantId) {
    return {
      plan: 'enterprise',
      maxActiveChitGroups: null,
      maxMembersPerChit: null,
      canExportStatutoryRegisters: true,
    };
  }

  const [sub, setting] = await Promise.all([
    db.tenantSubscription?.findUnique?.({
      where: { tenantId },
      select: {
        plan: true,
        basePlanPrice: true,
        maxActiveChitGroups: true,
        maxMembersPerChit: true,
        statutoryRegistersEnabled: true,
        grandfatheredFeatures: true,
      },
    }),
    db.appSetting?.findFirst?.({
      where: { tenantId, key: 'statutory_registers_enabled' },
      select: { value: true },
    }),
  ]);

  if (!sub) {
    return {
      plan: 'free',
      maxActiveChitGroups: 1,
      maxMembersPerChit: null,
      canExportStatutoryRegisters: setting?.value === 'true',
    };
  }

  const resolved = resolveChitPlanQuotas({
    plan: sub.plan,
    monthlyPrice: sub.basePlanPrice,
    maxActiveChitGroups: sub.maxActiveChitGroups,
    maxMembersPerChit: sub.maxMembersPerChit,
    statutoryRegistersEnabled: sub.statutoryRegistersEnabled,
    grandfatheredFeatures: sub.grandfatheredFeatures,
  });

  if (setting?.value === 'true') {
    resolved.canExportStatutoryRegisters = true;
  }

  return resolved;
}

/**
 * Enforces concurrent ACTIVE chit group limit (`completed` / `draft` / `cancelled` do NOT count).
 * Unlimited members per chit are permitted on all tiers unless explicitly capped in catalog.
 */
export async function assertCanActivateAnotherChitGroup(
  db: any,
  tenantId: string,
  excludeGroupId?: string,
): Promise<ChitPlanQuotaResolution> {
  const quota = await getChitPlanEntitlements(db, tenantId);
  if (quota.maxActiveChitGroups == null) return quota;

  const activeCount = await db.chitGroup.count({
    where: {
      tenantId,
      appType: 'chitfunds',
      status: 'active',
      deletedAt: null,
      ...(excludeGroupId ? { id: { not: excludeGroupId } } : {}),
    },
  });

  if (activeCount >= quota.maxActiveChitGroups) {
    throw new ChitPlanLimitError(activeCount, quota.maxActiveChitGroups);
  }
  return quota;
}

export async function assertCanExportStatutoryRegisters(db: any, tenantId: string): Promise<void> {
  const quota = await getChitPlanEntitlements(db, tenantId);
  if (!quota.canExportStatutoryRegisters) {
    throw new Error('Statutory register exports require an Enterprise plan or explicit tenant entitlement.');
  }
}
