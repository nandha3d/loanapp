'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog, getPeriodKey } from '@/lib/accounting/premium';

// Helper: get tax account codes
const GST_OUTPUT_CGST_CODE = '2310';
const GST_OUTPUT_SGST_CODE = '2320';
const GST_OUTPUT_IGST_CODE = '2330';
const GST_INPUT_CGST_CODE = '1410';
const GST_INPUT_SGST_CODE = '1420';
const GST_INPUT_IGST_CODE = '1430';

export type GstSummaryData = {
  periodKey: string;
  outputTaxable: number;
  outputCGST: number;
  outputSGST: number;
  outputIGST: number;
  inputTaxable: number;
  inputCGST: number;
  inputSGST: number;
  inputIGST: number;
  netCGST: number;
  netSGST: number;
  netIGST: number;
  totalLiability: number;
  itcCarryForward: number;
  status: string;
  filedAt: Date | null;
  filedById: string | null;
};

export async function recomputeGstSummary(
  periodKey: string,
): Promise<{ ok: boolean; data?: GstSummaryData; error?: string }> {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  // Find accounts by code
  const accounts = await prisma.account.findMany({
    where: {
      tenantId,
      code: {
        in: [
          GST_OUTPUT_CGST_CODE,
          GST_OUTPUT_SGST_CODE,
          GST_OUTPUT_IGST_CODE,
          GST_INPUT_CGST_CODE,
          GST_INPUT_SGST_CODE,
          GST_INPUT_IGST_CODE,
        ],
      },
    },
    select: { id: true, code: true },
  });

  const codeToId: Record<string, string> = {};
  for (const a of accounts) codeToId[a.code] = a.id;

  const [from, to] = periodKeyRange(periodKey);

  async function sumLines(accountCode: string, field: 'debit' | 'credit') {
    const accountId = codeToId[accountCode];
    if (!accountId) return 0;
    const agg = await prisma.journalLine.aggregate({
      _sum: { [field]: true },
      where: {
        accountId,
        entry: { tenantId, status: 'posted', entryDate: { gte: from, lte: to } },
      },
    });
    return Number((agg._sum as any)[field] ?? 0);
  }

  const [outputCGST, outputSGST, outputIGST, inputCGST, inputSGST, inputIGST] = await Promise.all([
    sumLines(GST_OUTPUT_CGST_CODE, 'credit'),
    sumLines(GST_OUTPUT_SGST_CODE, 'credit'),
    sumLines(GST_OUTPUT_IGST_CODE, 'credit'),
    sumLines(GST_INPUT_CGST_CODE, 'debit'),
    sumLines(GST_INPUT_SGST_CODE, 'debit'),
    sumLines(GST_INPUT_IGST_CODE, 'debit'),
  ]);

  const netCGST = Math.max(0, outputCGST - inputCGST);
  const netSGST = Math.max(0, outputSGST - inputSGST);
  const netIGST = Math.max(0, outputIGST - inputIGST);
  const totalLiability = netCGST + netSGST + netIGST;
  const itcCarryForward =
    Math.max(0, inputCGST - outputCGST) +
    Math.max(0, inputSGST - outputSGST) +
    Math.max(0, inputIGST - outputIGST);
  const netLiability = totalLiability;

  // Upsert GstSummary — schema has unique(tenantId, periodKey, gstType)
  const gs = await prisma.gstSummary.upsert({
    where: { tenantId_periodKey_gstType: { tenantId, periodKey, gstType: 'GSTR3B' } },
    create: {
      tenantId,
      periodKey,
      gstType: 'GSTR3B',
      outputCgst: outputCGST,
      outputSgst: outputSGST,
      outputIgst: outputIGST,
      inputCgst: inputCGST,
      inputSgst: inputSGST,
      inputIgst: inputIGST,
      netLiability,
    },
    update: {
      outputCgst: outputCGST,
      outputSgst: outputSGST,
      outputIgst: outputIGST,
      inputCgst: inputCGST,
      inputSgst: inputSGST,
      inputIgst: inputIGST,
      netLiability,
    },
  });

  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'recompute_gst',
    entityType: 'gst_summary',
    entityId: gs.id,
  });

  return {
    ok: true,
    data: {
      periodKey,
      outputTaxable: 0,
      outputCGST,
      outputSGST,
      outputIGST,
      inputTaxable: 0,
      inputCGST,
      inputSGST,
      inputIGST,
      netCGST,
      netSGST,
      netIGST,
      totalLiability,
      itcCarryForward,
      status: 'draft',
      filedAt: gs.filedAt,
      filedById: gs.filedById,
    },
  };
}

export async function markGstFiled(
  periodKey: string,
  _ackNo: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const gs = await prisma.gstSummary.findUnique({
    where: { tenantId_periodKey_gstType: { tenantId, periodKey, gstType: 'GSTR3B' } },
  });
  if (!gs) return { ok: false, error: 'No summary found. Recompute first.' };

  await prisma.gstSummary.update({
    where: { id: gs.id },
    data: { filedAt: new Date(), filedById: session.user?.id },
  });

  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'mark_gst_filed',
    entityType: 'gst_summary',
    entityId: gs.id,
    after: { filedAt: new Date().toISOString(), ackNo: _ackNo },
  });
  return { ok: true };
}

export async function getGstSummary(periodKey: string): Promise<GstSummaryData | null> {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const gs = await prisma.gstSummary.findUnique({
    where: { tenantId_periodKey_gstType: { tenantId, periodKey, gstType: 'GSTR3B' } },
  });
  if (!gs) return null;

  const outputCGST = Number(gs.outputCgst);
  const outputSGST = Number(gs.outputSgst);
  const outputIGST = Number(gs.outputIgst);
  const inputCGST = Number(gs.inputCgst);
  const inputSGST = Number(gs.inputSgst);
  const inputIGST = Number(gs.inputIgst);

  const netCGST = Math.max(0, outputCGST - inputCGST);
  const netSGST = Math.max(0, outputSGST - inputSGST);
  const netIGST = Math.max(0, outputIGST - inputIGST);

  return {
    periodKey,
    outputTaxable: 0,
    outputCGST,
    outputSGST,
    outputIGST,
    inputTaxable: 0,
    inputCGST,
    inputSGST,
    inputIGST,
    netCGST,
    netSGST,
    netIGST,
    totalLiability: Number(gs.netLiability),
    itcCarryForward:
      Math.max(0, inputCGST - outputCGST) + Math.max(0, inputSGST - outputSGST),
    status: gs.filedAt ? 'filed' : 'draft',
    filedAt: gs.filedAt,
    filedById: gs.filedById,
  };
}

export async function getTdsRegister(quarterKey: string): Promise<any[]> {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const { from, to } = quarterKeyRange(quarterKey);

  // TdsDeduction has: id, tenantId, billId, vendorId (via bill->vendor), section,
  // rate, baseAmount, tdsAmount, challanNo, challanDate, periodKey, status
  // No direct vendor relation; filter by tenantId + date range via periodKey or join
  const rows = await prisma.tdsDeduction.findMany({
    where: {
      // TdsDeduction has no paymentDate; use periodKey or createdAt
      createdAt: { gte: from, lte: to },
      bill: { tenantId },
    },
    include: {
      bill: {
        select: {
          tenantId: true,
          vendor: { select: { name: true, pan: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows
    .filter((r) => r.bill?.tenantId === tenantId)
    .map((r) => ({
      id: r.id,
      vendorName: r.bill?.vendor?.name ?? '—',
      pan: r.bill?.vendor?.pan ?? '—',
      section: r.section,
      taxableAmount: Number(r.baseAmount),
      ratePct: Number(r.rate),
      tdsAmount: Number(r.tdsAmount),
      challanNo: r.challanNo,
      status: r.status,
    }));
}

export async function recordChallan(input: {
  challanNo: string;
  challanDate: string;
  amount: number;
  deductionIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  await prisma.tdsDeduction.updateMany({
    where: {
      id: { in: input.deductionIds },
      bill: { tenantId },
    },
    data: {
      challanNo: input.challanNo,
      challanDate: new Date(input.challanDate),
      status: 'remitted',
    },
  });

  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'record_challan',
    entityType: 'tds',
    reason: `Challan ${input.challanNo}`,
  });
  return { ok: true };
}

// Utilities
function periodKeyRange(periodKey: string): [Date, Date] {
  const [y, m] = periodKey.split('-').map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0); // last day of month
  return [from, to];
}

function quarterKeyRange(quarterKey: string): { from: Date; to: Date } {
  // 'Q1-2026-27' = Apr-Jun 2026
  const match = quarterKey.match(/Q(\d)-(\d{4})/);
  if (!match) throw new Error('Invalid quarter key');
  const q = Number(match[1]);
  const fy = Number(match[2]);
  // Q1=Apr(3 0-indexed), Q2=Jul, Q3=Oct, Q4=Jan(next year)
  const startMonthOffset = (q - 1) * 3; // 0-based months from April
  const absStartMonth = (3 + startMonthOffset) % 12; // 0-indexed month
  const startYear = absStartMonth >= 3 ? fy : fy + 1;
  const absEndMonth = (absStartMonth + 2) % 12;
  const endYear = absEndMonth >= absStartMonth ? startYear : startYear + 1;
  const from = new Date(startYear, absStartMonth, 1);
  const to = new Date(endYear, absEndMonth + 1, 0); // last day of end month
  return { from, to };
}
