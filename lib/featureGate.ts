import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { PlanFeatureFlag } from '@/lib/planFeatures';

/** Whether the tenant's plan (or a Free-plan demo grant) switches this feature on. */
export async function isFeatureEnabled(tenantId: string, flag: PlanFeatureFlag): Promise<boolean> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { [flag]: true },
  });
  return Boolean((sub as Record<string, unknown> | null)?.[flag]);
}

/** 403 for API routes when eNACH is not part of the tenant's plan; null when allowed. */
export async function nachGate(tenantId: string): Promise<NextResponse | null> {
  if (await isFeatureEnabled(tenantId, 'nachEnabled')) return null;
  return NextResponse.json(
    { error: 'eNACH is not included in your plan. Upgrade to enable it.', code: 'FEATURE_NOT_IN_PLAN' },
    { status: 403 },
  );
}
