'use server';

import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { redirect } from 'next/navigation';
import { getPremiumTenantId } from '../access';
import type { PremiumAccountingActor } from '@/lib/accounting/premiumMobileService';
import type { BillInput, VendorInput } from '@/lib/accounting/vendors';
import {
  cancelBill as cancel,
  createBill as createPayable,
  createVendor as create,
  deactivateVendor as deactivate,
  getBill as bill,
  getVendorAccounts,
  getVendorAgeing,
  listBills as bills,
  listVendors as vendors,
  payBill as pay,
  postBill as post,
  updateVendor as update,
} from '@/lib/accounting/vendors';

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
    return { ok: false as const, error: error instanceof Error ? error.message : 'Accounting action failed' };
  }
}

export async function listVendors(filter?: { isActive?: boolean; search?: string }) {
  return plain(await vendors(await actor(), filter)) as any[];
}

export async function createVendor(input: VendorInput) {
  return result(create(await actor(), input));
}

export async function updateVendor(id: string, input: VendorInput) {
  return result(update(await actor(), id, input));
}

export async function deactivateVendor(id: string) {
  return result(deactivate(await actor(), id));
}

export async function listBills(filter?: { vendorId?: string; status?: string; search?: string }) {
  return plain(await bills(await actor(), filter)) as any[];
}

export async function getBill(id: string) {
  try {
    return plain(await bill(await actor(), id));
  } catch {
    return null;
  }
}

export async function createBill(input: BillInput) {
  return result(createPayable(await actor(), input));
}

export async function postBill(id: string) {
  return result(post(await actor(), id));
}

export async function payBill(id: string, input: {
  amount: number; date: string; payFromAccountId: string; tdsAmount?: number;
  reference?: string; narration?: string;
}) {
  return result(pay(await actor(), id, input));
}

export async function cancelBill(id: string) {
  return result(cancel(await actor(), id));
}

export async function getAgeingReport() {
  return plain(await getVendorAgeing(await actor()));
}

export async function getExpenseAccounts() {
  return plain(await getVendorAccounts(await actor(), 'expense'));
}

export async function getBankAccounts() {
  return plain(await getVendorAccounts(await actor(), 'payment'));
}
