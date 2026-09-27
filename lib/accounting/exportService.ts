import ExcelJS from 'exceljs';
import prisma from '@/lib/db';
import { getOrCreateAccountingSettings } from '@/lib/accounting/premium';
import { generateTallyXml, TallyExportLimitError } from '@/lib/accounting/tallyExport';
import {
  assertPremiumAccountingAccess,
  PremiumAccountingActor,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';

export type AccountingExportKind = 'tally_xml' | 'json' | 'excel';

function requireReviewer(actor: PremiumAccountingActor) {
  if (!['superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
}

function monthRange(periodKey: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new PremiumAccountingServiceError('Invalid period', 400);
  }
  const [year, month] = periodKey.split('-').map(Number);
  return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
}

export function dateRange(from: string, to: string) {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== 'string' || typeof to !== 'string' || !valid.test(from) || !valid.test(to)) {
    throw new PremiumAccountingServiceError('Invalid date range', 400);
  }
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start ||
      `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` !== from ||
      `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}` !== to) {
    throw new PremiumAccountingServiceError('Invalid date range', 400);
  }
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function recordRun(actor: PremiumAccountingActor, kind: AccountingExportKind,
  periodKey: string, filename: string, fileSize: number) {
  await prisma.$transaction(async (tx) => {
    const run = await tx.accountingExportRun.create({ data: {
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
      kind, periodKey, filename, fileSize, byUserId: actor.userId,
    } });
    await tx.accountingAuditLog.create({ data: {
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
      userId: actor.userId, action: 'export', entityType: kind, entityId: run.id,
      after: JSON.stringify({ periodKey, filename }),
    } });
  });
}

export async function generateAccountingExport(actor: PremiumAccountingActor, input: {
  kind: AccountingExportKind; periodKey?: string; from?: string; to?: string;
}) {
  await assertPremiumAccountingAccess(actor);
  requireReviewer(actor);
  const kind = input.kind;
  if (!['tally_xml', 'json', 'excel'].includes(kind)) {
    throw new PremiumAccountingServiceError('Invalid export type', 400);
  }
  const periodKey = kind === 'json' ? input.from?.slice(0, 7) ?? '' : input.periodKey ?? '';
  const suffix = actor.branchId ? `_${actor.branchId}` : '';
  let filename: string;
  let mimeType: string;
  let bytes: Buffer;

  if (kind === 'tally_xml') {
    const { from, to } = monthRange(periodKey);
    const result = await generateTallyXml({
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
      fromDate: from, toDate: new Date(to.getTime() - 1), status: 'posted',
    }).catch((error: unknown) => {
      if (error instanceof TallyExportLimitError) throw new PremiumAccountingServiceError(error.message, 413);
      throw error;
    });
    filename = `tally_vouchers_${periodKey}${suffix}.xml`;
    mimeType = 'application/xml';
    bytes = Buffer.from(result.xml, 'utf8');
  } else if (kind === 'json') {
    const { start, end } = dateRange(input.from ?? '', input.to ?? '');
    const [accounts, journalEntries, bills, periodStatus] = await Promise.all([
      prisma.account.findMany({ where: { tenantId: actor.tenantId, isActive: true }, orderBy: { code: 'asc' } }),
      prisma.journalEntry.findMany({ where: {
        tenantId: actor.tenantId, appType: actor.appType,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        entryDate: { gte: start, lt: end },
      }, include: { lines: { include: { account: { select: { code: true, name: true } } },
        orderBy: { lineNo: 'asc' } } }, orderBy: [{ entryDate: 'asc' }, { entryNo: 'asc' }] }),
      prisma.bill.findMany({ where: {
        tenantId: actor.tenantId, appType: actor.appType,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        billDate: { gte: start, lt: end },
      }, include: { vendor: { select: { name: true } } }, orderBy: { billDate: 'asc' } }),
      prisma.accountingPeriod.findFirst({ where: {
        tenantId: actor.tenantId, appType: actor.appType, periodKey,
      } }),
    ]);
    bytes = Buffer.from(JSON.stringify({
      meta: { exportedAt: new Date().toISOString(), tenantId: actor.tenantId,
        branchId: actor.branchId ?? null, from: input.from, to: input.to, periodKey },
      accounts, journalEntries, bills, periodStatus,
    }, null, 2), 'utf8');
    filename = `accounting_dump_${periodKey}${suffix}.json`;
    mimeType = 'application/json';
  } else {
    const { from, to } = monthRange(periodKey);
    const entries = await prisma.journalEntry.findMany({ where: {
      tenantId: actor.tenantId, appType: actor.appType, status: 'posted',
      ...(actor.branchId ? { branchId: actor.branchId } : {}),
      entryDate: { gte: from, lt: to },
    }, include: { lines: { include: { account: { select: { code: true, name: true } } },
      orderBy: { lineNo: 'asc' } }, createdBy: { select: { name: true } } },
      orderBy: [{ entryDate: 'asc' }, { entryNo: 'asc' }] });
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Cover').addRows([
      ['Accounting Export'], ['Period', periodKey], ['Branch', actor.branchId ?? 'All'],
      ['Exported At', new Date().toISOString()], ['Total JEs', entries.length],
    ]);
    const sheet = workbook.addWorksheet('Journal Book');
    sheet.addRow(['Entry No', 'Date', 'Narration', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Posted By']);
    for (const entry of entries) for (const line of entry.lines) sheet.addRow([
      entry.entryNo ?? entry.id, entry.entryDate.toISOString().slice(0, 10), entry.narration ?? '',
      line.account.code, line.account.name, Number(line.debit), Number(line.credit),
      entry.createdBy?.name ?? '',
    ]);
    bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    filename = `journal_book_${periodKey}${suffix}.xlsx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  await recordRun(actor, kind, periodKey, filename, bytes.length);
  return { filename, mimeType, bytes };
}

export async function listAccountingExportRuns(actor: PremiumAccountingActor, page?: number) {
  await assertPremiumAccountingAccess(actor);
  if (page !== undefined && (!Number.isSafeInteger(page) || page < 1)) {
    throw new PremiumAccountingServiceError('Invalid page', 400);
  }
  const where = { tenantId: actor.tenantId, appType: actor.appType,
    ...(actor.branchId ? { branchId: actor.branchId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.accountingExportRun.findMany({ where, orderBy: { createdAt: 'desc' },
      skip: page ? (page - 1) * 50 : 0, take: page ? 50 : 20 }),
    page ? prisma.accountingExportRun.count({ where }) : Promise.resolve(0),
  ]);
  const userIds = [...new Set(rows.map((row) => row.byUserId))];
  const users = await prisma.user.findMany({
    where: { tenantId: actor.tenantId, id: { in: userIds } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));
  const enriched = rows.map((row) => ({ ...row, byUser: { name: names.get(row.byUserId) ?? '' } }));
  return page ? { rows: enriched, total, page, pages: Math.ceil(total / 50) } : enriched;
}

const testRequest = '<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>';

export function parseTallyConnectorUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PremiumAccountingServiceError('Invalid Tally connector URL', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PremiumAccountingServiceError('Invalid Tally connector URL', 400);
  }
  return url.toString();
}

async function connectorUrl(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  requireReviewer(actor);
  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  if (!settings.tallyConnectorEnabled || !settings.tallyConnectorUrl) {
    throw new PremiumAccountingServiceError('Tally connector is not configured', 400);
  }
  return parseTallyConnectorUrl(settings.tallyConnectorUrl);
}

export async function testAccountingTallyConnector(actor: PremiumAccountingActor, suppliedUrl?: string) {
  const url = await connectorUrl(actor);
  if (suppliedUrl && suppliedUrl !== url && suppliedUrl !== url.replace(/\/$/, '')) {
    throw new PremiumAccountingServiceError('Connector URL does not match settings', 400);
  }
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: testRequest, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const xml = await response.text();
    const company = xml.match(/<COMPANYNAME>(.*?)<\/COMPANYNAME>/i)?.[1] ??
      xml.match(/<COMPANY>(.*?)<\/COMPANY>/i)?.[1];
    return { ok: true, company };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function pushAccountingToTally(actor: PremiumAccountingActor, periodKey: string) {
  const url = await connectorUrl(actor);
  const { from, to } = monthRange(periodKey);
  const { xml } = await generateTallyXml({ tenantId: actor.tenantId, appType: actor.appType,
    branchId: actor.branchId, fromDate: from, toDate: new Date(to.getTime() - 1), status: 'posted' }).catch((error: unknown) => {
    if (error instanceof TallyExportLimitError) throw new PremiumAccountingServiceError(error.message, 413);
    throw error;
  });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: xml, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new PremiumAccountingServiceError(`Tally HTTP ${response.status}`, 502);
  const text = await response.text();
  const lines = text.split('\n');
  const created = lines.filter((line) => /created|altered/i.test(line)).length;
  const ignored = lines.filter((line) => /already exists|duplicate/i.test(line)).length;
  const errors = lines.filter((line) => /error|failed/i.test(line)).map((line) => line.trim());
  await prisma.accountingAuditLog.create({ data: {
    tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
    userId: actor.userId, action: 'push_tally', entityType: 'tally_connector',
    after: JSON.stringify({ periodKey, created, ignored, errors: errors.length }),
  } });
  return { created, ignored, errors: errors.slice(0, 20) };
}
