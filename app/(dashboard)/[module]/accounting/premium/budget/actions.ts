'use server';

import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { getPremiumTenantId } from '../access';
import { getActiveBranchId } from '@/lib/branch';
import { redirect } from 'next/navigation';
import type { PremiumAccountingActor } from '@/lib/accounting/premiumMobileService';
import {
  addBudgetLine as addLine,
  createBudget as create,
  getBudget,
  getBudgetAccounts,
  getBudgetVariance,
  listBudgets as list,
  setBudgetStatus,
  updateBudgetLine as updateLine,
} from '@/lib/accounting/budgets';

async function actor(): Promise<PremiumAccountingActor> {
  const session = await auth();
  if (!session) redirect('/login');
  return {
    tenantId: await getPremiumTenantId(),
    appType: await getUserAppType(),
    branchId: await getActiveBranchId(),
    userId: session.user.id!,
    role: (session.user as { role?: string }).role ?? '',
  };
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function result<T>(operation: Promise<T>) {
  try {
    return { ok: true as const, data: plain(await operation) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Budget failed' };
  }
}

export async function listBudgets() {
  return plain(await list(await actor()));
}

export async function createBudget(input: { name: string; fiscalYear: string }) {
  return result(create(await actor(), input));
}

export async function getBudgetWithLines(budgetId: string) {
  try {
    return plain(await getBudget(await actor(), budgetId));
  } catch {
    return null;
  }
}

export async function updateBudgetLine(lineId: string, field: string, value: number) {
  return result(updateLine(await actor(), lineId, field, value));
}

export async function addBudgetLine(budgetId: string, accountId: string) {
  return result(addLine(await actor(), budgetId, accountId));
}

export async function approveBudget(budgetId: string) {
  return result(setBudgetStatus(await actor(), budgetId, 'approve'));
}

export async function archiveBudget(budgetId: string) {
  return result(setBudgetStatus(await actor(), budgetId, 'archive'));
}

export async function getVarianceForPeriod(budgetId: string, periodKey: string) {
  return plain(await getBudgetVariance(await actor(), budgetId, periodKey));
}

export async function getActiveAccounts() {
  return plain(await getBudgetAccounts(await actor()));
}
