'use server';

import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getPremiumTenantId } from '../access';
import type { PremiumAccountingActor } from '@/lib/accounting/premiumMobileService';
import {
  generateAccountingExport,
  listAccountingExportRuns,
  pushAccountingToTally,
  testAccountingTallyConnector,
} from '@/lib/accounting/exportService';

async function actor(): Promise<PremiumAccountingActor> {
  const session = await auth();
  if (!session) redirect('/login');
  return { tenantId: await getPremiumTenantId(), appType: await getUserAppType(),
    branchId: await getActiveBranchId(), userId: session.user.id!,
    role: (session.user as { role?: string }).role ?? '' };
}

export async function exportTallyXml(periodKey: string, _branchId?: string | null) {
  const file = await generateAccountingExport(await actor(), { kind: 'tally_xml', periodKey });
  return { xml: file.bytes.toString('utf8'), filename: file.filename };
}

export async function exportJsonDump(from: string, to: string, _branchId?: string | null) {
  const file = await generateAccountingExport(await actor(), { kind: 'json', from, to });
  return { json: file.bytes.toString('utf8'), filename: file.filename };
}

export async function exportExcelWorkbook(periodKey: string, _branchId?: string | null) {
  const file = await generateAccountingExport(await actor(), { kind: 'excel', periodKey });
  return { buffer: file.bytes.toString('base64'), filename: file.filename };
}

export async function listExportRuns() {
  return JSON.parse(JSON.stringify(await listAccountingExportRuns(await actor())));
}

export async function testTallyConnector(url: string) {
  return testAccountingTallyConnector(await actor(), url);
}

export async function pushToTally(periodKey: string) {
  return pushAccountingToTally(await actor(), periodKey);
}
