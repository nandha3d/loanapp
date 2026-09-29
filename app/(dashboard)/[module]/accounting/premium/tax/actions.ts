'use server';

import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getPremiumTenantId } from '../access';
import type { PremiumAccountingActor } from '@/lib/accounting/premiumMobileService';
import type { GstSummaryData } from '@/lib/accounting/tax';
import {
  getGstSummary as readGst,
  getTdsRegister as readTds,
  markGstFiled as fileGst,
  recomputeGstSummary as recomputeGst,
  recordChallan as recordTds,
} from '@/lib/accounting/tax';

async function actor(): Promise<PremiumAccountingActor> {
  const session = await auth();
  if (!session) redirect('/login');
  return {
    tenantId: await getPremiumTenantId(), appType: await getUserAppType(),
    branchId: await getActiveBranchId(), userId: session.user.id!,
    role: (session.user as { role?: string }).role ?? '',
  };
}

async function result<T>(action: Promise<T>) {
  try { return { ok: true as const, data: await action }; }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : 'Tax action failed' }; }
}

export async function recomputeGstSummary(periodKey: string) {
  return result(recomputeGst(await actor(), periodKey));
}

export async function markGstFiled(periodKey: string, ackNo: string) {
  return result(fileGst(await actor(), periodKey, ackNo));
}

export async function getGstSummary(periodKey: string): Promise<GstSummaryData | null> {
  return readGst(await actor(), periodKey);
}

export async function getTdsRegister(quarterKey: string) {
  return readTds(await actor(), quarterKey);
}

export async function recordChallan(input: {
  challanNo: string; challanDate: string; amount: number; deductionIds: string[];
}) {
  return result(recordTds(await actor(), input));
}
