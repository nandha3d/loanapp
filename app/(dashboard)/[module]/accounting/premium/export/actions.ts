'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getOrCreateAccountingSettings, getPeriodKey, writeAuditLog } from '@/lib/accounting/premium';
import * as XLSX from 'xlsx';

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) throw new Error('Unauthorized');
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type JournalEntryWithLines = {
  id: string;
  entryNo: string | null;
  entryDate: Date;
  narration: string | null;
  lines: Array<{
    debit: any;
    credit: any;
    account: { name: string };
  }>;
};

function buildTallyXml(jes: JournalEntryWithLines[], companyName: string): string {
  const messages = jes
    .map((je) => {
      const lines = je.lines
        .map(
          (l) => `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escXml(l.account.name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${Number(l.debit) > 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${Number(l.debit) > 0 ? -Number(l.debit) : Number(l.credit)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`,
        )
        .join('');

      const dateStr =
        je.entryDate instanceof Date
          ? je.entryDate.toISOString().slice(0, 10).replace(/-/g, '')
          : String(je.entryDate).slice(0, 10).replace(/-/g, '');

      return `
      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="Journal" ACTION="Create">
          <DATE>${dateStr}</DATE>
          <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escXml(je.entryNo ?? je.id)}</VOUCHERNUMBER>
          <NARRATION>${escXml(je.narration ?? '')}</NARRATION>
          ${lines}
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${escXml(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages}</REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function periodKeyToDates(periodKey: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = periodKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  return {
    from: new Date(year, month, 1),
    to: new Date(year, month + 1, 0),
  };
}

function dateStringToPeriodKey(dateStr: string): string {
  return getPeriodKey(new Date(dateStr));
}

// ─── Fetch posted JEs for a period ───────────────────────────────────────────

async function fetchPostedJEs(
  tenantId: string,
  periodKey: string,
  branchId?: string | null,
): Promise<JournalEntryWithLines[]> {
  const { from, to } = periodKeyToDates(periodKey);
  return prisma.journalEntry.findMany({
    where: {
      tenantId,
      status: 'posted',
      entryDate: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      lines: {
        include: { account: { select: { name: true } } },
        orderBy: { lineNo: 'asc' },
      },
    },
    orderBy: [{ entryDate: 'asc' }, { entryNo: 'asc' }],
  }) as Promise<JournalEntryWithLines[]>;
}

// ─── Record export run ────────────────────────────────────────────────────────

async function recordExportRun(params: {
  tenantId: string;
  userId: string;
  kind: 'tally_xml' | 'excel' | 'json';
  periodKey: string;
  branchId?: string | null;
  filename: string;
  fileSize: number;
}) {
  await prisma.accountingExportRun.create({
    data: {
      tenantId: params.tenantId,
      kind: params.kind,
      periodKey: params.periodKey,
      branchId: params.branchId ?? null,
      filename: params.filename,
      fileSize: params.fileSize,
      byUserId: params.userId,
    },
  });
}

// ─── exportTallyXml ───────────────────────────────────────────────────────────

export async function exportTallyXml(
  periodKey: string,
  branchId?: string | null,
): Promise<{ xml: string; filename: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string;
  requireRole(role, ['superadmin', 'developer']);

  const tenantId = await getDefaultTenantId();
  const settings = await getOrCreateAccountingSettings(tenantId);
  const companyName = settings.tallyCompanyName ?? 'My Company';

  const activeBranchId = branchId ?? (await getActiveBranchId());
  const jes = await fetchPostedJEs(tenantId, periodKey, activeBranchId);

  const xml = buildTallyXml(jes, companyName);
  const filename = `tally_vouchers_${periodKey}${activeBranchId ? `_${activeBranchId}` : ''}.xml`;

  await recordExportRun({
    tenantId,
    userId,
    kind: 'tally_xml',
    periodKey,
    branchId: activeBranchId,
    filename,
    fileSize: Buffer.byteLength(xml, 'utf8'),
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'export',
    entityType: 'tally_xml',
    after: { periodKey, filename },
  });

  return { xml, filename };
}

// ─── exportJsonDump ───────────────────────────────────────────────────────────

export async function exportJsonDump(
  from: string,
  to: string,
  branchId?: string | null,
): Promise<{ json: string; filename: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string;
  requireRole(role, ['superadmin', 'developer']);

  const tenantId = await getDefaultTenantId();
  const activeBranchId = branchId ?? (await getActiveBranchId());
  const periodKey = dateStringToPeriodKey(from);

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const [accounts, journalEntries, bills, periodStatus] = await Promise.all([
    prisma.account.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.journalEntry.findMany({
      where: {
        tenantId,
        entryDate: { gte: fromDate, lte: toDate },
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: 'asc' } },
      },
      orderBy: [{ entryDate: 'asc' }, { entryNo: 'asc' }],
    }),
    prisma.bill.findMany({
      where: {
        tenantId,
        billDate: { gte: fromDate, lte: toDate },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: { billDate: 'asc' },
    }),
    prisma.accountingPeriod.findUnique({
      where: { tenantId_periodKey: { tenantId, periodKey } },
    }),
  ]);

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      tenantId,
      branchId: activeBranchId,
      from,
      to,
      periodKey,
    },
    accounts: JSON.parse(JSON.stringify(accounts)),
    journalEntries: JSON.parse(JSON.stringify(journalEntries)),
    bills: JSON.parse(JSON.stringify(bills)),
    periodStatus: periodStatus ? JSON.parse(JSON.stringify(periodStatus)) : null,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `accounting_dump_${periodKey}${activeBranchId ? `_${activeBranchId}` : ''}.json`;

  await recordExportRun({
    tenantId,
    userId,
    kind: 'json',
    periodKey,
    branchId: activeBranchId,
    filename,
    fileSize: Buffer.byteLength(json, 'utf8'),
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'export',
    entityType: 'json_dump',
    after: { periodKey, filename, from, to },
  });

  return { json, filename };
}

// ─── exportExcelWorkbook ──────────────────────────────────────────────────────

export async function exportExcelWorkbook(
  periodKey: string,
  branchId?: string | null,
): Promise<{ buffer: string; filename: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string;
  requireRole(role, ['superadmin', 'developer']);

  const tenantId = await getDefaultTenantId();
  const activeBranchId = branchId ?? (await getActiveBranchId());
  const { from, to } = periodKeyToDates(periodKey);

  const jes = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      status: 'posted',
      entryDate: { gte: from, lte: to },
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
    },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: 'asc' } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ entryDate: 'asc' }, { entryNo: 'asc' }],
  });

  const wb = XLSX.utils.book_new();

  // Cover sheet
  const coverData = [
    ['Accounting Export'],
    ['Period', periodKey],
    ['Branch', activeBranchId ?? 'All'],
    ['Exported At', new Date().toISOString()],
    ['Total JEs', jes.length],
  ];
  const coverWs = XLSX.utils.aoa_to_sheet(coverData);
  XLSX.utils.book_append_sheet(wb, coverWs, 'Cover');

  // Journal Book sheet
  const jbRows: any[][] = [
    ['Entry No', 'Date', 'Narration', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Posted By'],
  ];
  for (const je of jes) {
    for (const line of je.lines) {
      jbRows.push([
        je.entryNo ?? je.id,
        je.entryDate instanceof Date ? je.entryDate.toISOString().slice(0, 10) : String(je.entryDate).slice(0, 10),
        je.narration ?? '',
        line.account.code,
        line.account.name,
        Number(line.debit),
        Number(line.credit),
        (je as any).createdBy?.name ?? '',
      ]);
    }
  }
  const jbWs = XLSX.utils.aoa_to_sheet(jbRows);
  XLSX.utils.book_append_sheet(wb, jbWs, 'Journal Book');

  const buffer = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `journal_book_${periodKey}${activeBranchId ? `_${activeBranchId}` : ''}.xlsx`;

  await recordExportRun({
    tenantId,
    userId,
    kind: 'excel',
    periodKey,
    branchId: activeBranchId,
    filename,
    fileSize: Math.round((buffer.length * 3) / 4),
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'export',
    entityType: 'excel',
    after: { periodKey, filename },
  });

  return { buffer, filename };
}

// ─── listExportRuns ───────────────────────────────────────────────────────────

export async function listExportRuns() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  const tenantId = await getDefaultTenantId();

  const runs = await prisma.accountingExportRun.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Enrich with user names
  const userIds = [...new Set(runs.map((r) => r.byUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const enriched = runs.map((r) => ({
    ...r,
    byUser: { name: userMap.get(r.byUserId) ?? r.byUserId },
  }));

  return JSON.parse(JSON.stringify(enriched));
}

// ─── testTallyConnector ───────────────────────────────────────────────────────

export async function testTallyConnector(
  url: string,
): Promise<{ ok: boolean; company?: string; error?: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  requireRole(role, ['superadmin', 'developer']);

  const requestXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: requestXml,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    // Try to extract company name from response
    const match = text.match(/<COMPANY>(.*?)<\/COMPANY>/i);
    const nameMatch = text.match(/<COMPANYNAME>(.*?)<\/COMPANYNAME>/i);
    const company = nameMatch?.[1] ?? match?.[1] ?? undefined;

    return { ok: true, company };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// ─── pushToTally ─────────────────────────────────────────────────────────────

export async function pushToTally(
  periodKey: string,
): Promise<{ created: number; ignored: number; errors: string[] }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string;
  requireRole(role, ['superadmin', 'developer']);

  const tenantId = await getDefaultTenantId();
  const settings = await getOrCreateAccountingSettings(tenantId);

  if (!settings.tallyConnectorEnabled || !settings.tallyConnectorUrl) {
    throw new Error('Tally connector is not configured');
  }

  const companyName = settings.tallyCompanyName ?? 'My Company';
  const activeBranchId = await getActiveBranchId();
  const jes = await fetchPostedJEs(tenantId, periodKey, activeBranchId);

  const xml = buildTallyXml(jes, companyName);

  const res = await fetch(settings.tallyConnectorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: xml,
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();

  // Parse response: count CREATED / ALTERED / error lines
  let created = 0;
  let ignored = 0;
  const errors: string[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('created') || lower.includes('altered')) {
      created++;
    } else if (lower.includes('already exists') || lower.includes('duplicate')) {
      ignored++;
    } else if (lower.includes('error') || lower.includes('failed')) {
      errors.push(line.trim());
    }
  }

  // Also check for XML-based error elements
  const errorMatches = text.match(/<LINEERROR>(.*?)<\/LINEERROR>/gi) ?? [];
  for (const em of errorMatches) {
    const msg = em.replace(/<\/?LINEERROR>/gi, '').trim();
    if (msg) errors.push(msg);
  }

  await writeAuditLog({
    tenantId,
    userId,
    action: 'push_tally',
    entityType: 'tally_connector',
    after: { periodKey, created, ignored, errors: errors.length },
  });

  return { created, ignored, errors: errors.slice(0, 20) };
}
