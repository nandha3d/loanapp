'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { getPremiumTenantId as getDefaultTenantId } from '../access';
import { getActiveBranchId } from '@/lib/branch';
import { revalidatePath } from 'next/cache';
import { seedDefaultCoA } from '@/lib/accounting/seedDefaultCoA';
import { defaultNormalSide } from '@/lib/accounting/enums';
import { writePremiumAuditLog as writeAuditLog } from '../access';
import { getModuleAccountBalances } from '@/lib/accounting/queries';

function hasRole(role: string | undefined, allowed: string[]) {
  return !!role && allowed.includes(role);
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function getAccountsForTenant(tenantId: string, appType: string, branchId: string | null, showInactive = false) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, ...(showInactive ? {} : { isActive: true }) },
    orderBy: { code: 'asc' },
  });
  const balMap = await getModuleAccountBalances(tenantId, appType, branchId);
  return accounts.map((a) => ({ ...a, balance: balMap.get(a.id) ?? null }));
}

export async function createAccount(input: {
  code: string; name: string; classType: string; subType?: string;
  parentId?: string; isCash?: boolean; description?: string;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!hasRole(role, ['superadmin', 'developer'])) return { error: 'Unauthorized' };
  const tenantId = await getDefaultTenantId();
  const exists = await prisma.account.findUnique({ where: { tenantId_code: { tenantId, code: input.code } } });
  if (exists) return { error: 'duplicateCode' };
  const normalSide = defaultNormalSide(input.classType as any);
  const account = await prisma.account.create({
    data: { tenantId, code: input.code, name: input.name, classType: input.classType, subType: input.subType, normalSide, isCash: input.isCash ?? false, parentId: input.parentId ?? null, description: input.description },
  });
  await writeAuditLog({ tenantId, userId, action: 'create', entityType: 'account', entityId: account.id, after: { code: account.code, name: account.name } });
  revalidatePath('/accounting/premium/coa');
  return { success: true, account: serialize(account) };
}

export async function updateAccount(id: string, input: { name?: string; subType?: string; parentId?: string | null; isCash?: boolean; description?: string; isActive?: boolean }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!hasRole(role, ['superadmin', 'developer'])) return { error: 'Unauthorized' };
  const tenantId = await getDefaultTenantId();
  const account = await prisma.account.findFirst({ where: { id, tenantId } });
  if (!account) return { error: 'not_found' };
  const updated = await prisma.account.update({ where: { id }, data: { name: input.name, subType: input.subType, parentId: input.parentId, isCash: input.isCash, description: input.description, isActive: input.isActive, updatedAt: new Date() } });
  await writeAuditLog({ tenantId, userId, action: 'update', entityType: 'account', entityId: id, after: input });
  revalidatePath('/accounting/premium/coa');
  return { success: true, account: serialize(updated) };
}

export async function deactivateAccount(id: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!hasRole(role, ['superadmin', 'developer'])) return { error: 'Unauthorized' };
  const tenantId = await getDefaultTenantId();
  const account = await prisma.account.findFirst({ where: { id, tenantId } });
  if (!account) return { error: 'not_found' };
  const nextActive = !account.isActive;
  if (!nextActive) {
    const children = await prisma.account.count({ where: { parentId: id, isActive: true } });
    if (children > 0) return { error: 'has_active_children' };
  }
  const updated = await prisma.account.update({ where: { id }, data: { isActive: nextActive } });
  await writeAuditLog({ tenantId, userId, action: 'update', entityType: 'account', entityId: id, after: { isActive: nextActive } });
  revalidatePath('/accounting/premium/coa');
  return { success: true, account: serialize(updated), isActive: nextActive };
}

export async function reseedDefaultCoA() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!hasRole(role, ['superadmin', 'developer'])) return { error: 'Unauthorized' };
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  const result = await seedDefaultCoA(tenantId);
  const accounts = await getAccountsForTenant(tenantId, appType, branchId, true);
  revalidatePath('/accounting/premium/coa');
  return { success: true, ...result, accounts: serialize(accounts) };
}

export async function listAccounts(showInactive = false) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  return serialize(await getAccountsForTenant(tenantId, appType, branchId, showInactive));
}
