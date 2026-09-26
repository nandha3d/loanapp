import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { isPremiumAccountingEnabled, writeAuditLog } from '@/lib/accounting/premium';

export async function getPremiumTenantId() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !['admin', 'superadmin', 'developer'].includes(role)) throw new Error('Unauthorized');
  const tenantId = await getDefaultTenantId();
  if (!await isPremiumAccountingEnabled(tenantId)) {
    throw new Error('Premium Accounting is not enabled for your subscription.');
  }
  return tenantId;
}

export async function writePremiumAuditLog(params: Parameters<typeof writeAuditLog>[0]) {
  const [appType, branchId] = await Promise.all([getUserAppType(), getActiveBranchId()]);
  return writeAuditLog({ ...params, appType, branchId: params.branchId ?? branchId });
}
