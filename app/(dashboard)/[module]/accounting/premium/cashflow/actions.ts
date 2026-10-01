'use server';

import { getUserAppType } from '@/lib/tenant';
import { getPremiumTenantId as getDefaultTenantId } from '../access';
import { getActiveBranchId } from '@/lib/branch';
import { getCashFlowStatement } from '@/lib/accounting/cashflow';

export async function getCashFlowData(from: string, to: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  // ACC-02: same statement mobile renders (lib/accounting/cashflow.ts).
  return JSON.parse(JSON.stringify(await getCashFlowStatement(tenantId, appType, branchId, from, to)));
}
