/**
 * GST export — builds GSTR-1-style CSV rows from posted journal entries that
 * carry tax lines (JournalLine.taxCode + taxableAmount).
 *
 * NBFC note: interest income is GST-exempt; only fee/penalty/charge entries
 * should carry tax lines. GSTIN + state come from AccountingSettings.
 */
import prisma from '@/lib/db';
import { getOrCreateAccountingSettings } from './premium';

export interface Gstr1Row {
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceValue: number;
  placeOfSupply: string;
  taxRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  supplyType: string;
}

// taxCode convention: 'gst18', 'gst12', 'cgst9', 'sgst9', 'igst18' …
function parseTaxCode(code: string): { kind: 'cgst' | 'sgst' | 'igst' | 'gst' | null; rate: number } {
  const m = code.toLowerCase().match(/^(cgst|sgst|igst|gst)(\d+(?:\.\d+)?)$/);
  if (!m) return { kind: null, rate: 0 };
  return { kind: m[1] as 'cgst' | 'sgst' | 'igst' | 'gst', rate: parseFloat(m[2]) };
}

export async function getGstr1Rows(params: {
  tenantId: string;
  month: number; // 1-12
  year: number;
}): Promise<{ rows: Gstr1Row[]; gstin: string; state: string }> {
  const settings = await getOrCreateAccountingSettings(params.tenantId);
  const gstin = settings.gstin ?? '';
  const state = settings.state ?? '';

  const fromDate = new Date(params.year, params.month - 1, 1);
  const toDate = new Date(params.year, params.month, 0, 23, 59, 59);

  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId: params.tenantId,
      entryDate: { gte: fromDate, lte: toDate },
      status: 'posted',
      lines: { some: { taxCode: { not: null } } },
    },
    include: {
      lines: { orderBy: { lineNo: 'asc' } },
    },
    orderBy: { entryDate: 'asc' },
    take: 50_000,
  });

  const rows: Gstr1Row[] = [];

  for (const je of entries) {
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxableValue = 0;
    let maxRate = 0;

    for (const line of je.lines) {
      if (!line.taxCode) continue;
      const { kind, rate } = parseTaxCode(line.taxCode);
      if (!kind) continue;
      // Tax collected on outward supply sits on the credit side
      const taxAmount = Number(line.credit) - Number(line.debit);
      if (kind === 'cgst') cgst += taxAmount;
      else if (kind === 'sgst') sgst += taxAmount;
      else if (kind === 'igst') igst += taxAmount;
      else {
        // generic 'gstNN' code: split half CGST / half SGST (intra-state)
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      }
      taxableValue += Number(line.taxableAmount ?? 0);
      // For split codes the per-component rate is half the full GST rate
      const fullRate = kind === 'cgst' || kind === 'sgst' ? rate * 2 : rate;
      if (fullRate > maxRate) maxRate = fullRate;
    }

    const totalTax = cgst + sgst + igst;
    if (totalTax <= 0.005) continue;

    rows.push({
      invoiceNo: je.entryNo ?? je.id,
      invoiceDate: je.entryDate.toISOString().slice(0, 10),
      invoiceValue: Math.round((taxableValue + totalTax) * 100) / 100,
      placeOfSupply: state,
      taxRate: maxRate,
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      supplyType: 'B2C',
    });
  }

  return { rows, gstin, state };
}

export async function generateGstr1Csv(params: {
  tenantId: string;
  month: number;
  year: number;
}): Promise<string> {
  const { rows, gstin } = await getGstr1Rows(params);
  const settings = await getOrCreateAccountingSettings(params.tenantId);

  const header = [
    'GSTIN of Supplier', 'Invoice Number', 'Invoice Date', 'Invoice Value',
    'Place Of Supply', 'Tax Rate', 'Invoice Type', 'Taxable Value',
    'CGST', 'SGST', 'IGST',
  ].join(',');

  const body = rows.map((r) =>
    [
      gstin,
      r.invoiceNo,
      r.invoiceDate,
      r.invoiceValue.toFixed(2),
      `"${(r.placeOfSupply || settings.state || '').replace(/"/g, '""')}"`,
      `${r.taxRate}%`,
      r.supplyType,
      r.taxableValue.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.igst.toFixed(2),
    ].join(','),
  );

  return [header, ...body].join('\n');
}
