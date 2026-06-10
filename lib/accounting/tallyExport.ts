/**
 * Tally XML export — generates a TallyPrime "Import Data" envelope of
 * Vouchers from posted JournalEntries so accountants can import LoanTrack
 * books into Tally (Gateway of Tally → Import Data → Vouchers).
 *
 * Sign convention per Tally XML spec:
 *   debit line  → ISDEEMEDPOSITIVE = Yes, AMOUNT negative
 *   credit line → ISDEEMEDPOSITIVE = No,  AMOUNT positive
 */
import prisma from '@/lib/db';
import { getOrCreateAccountingSettings } from './premium';

function formatTallyDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const VALID_VOUCHER_TYPES = new Set(['Journal', 'Receipt', 'Payment', 'Contra']);

export async function generateTallyXml(params: {
  tenantId: string;
  fromDate: Date;
  toDate: Date;
  status?: string; // default 'posted'
}): Promise<{ xml: string; voucherCount: number }> {
  const settings = await getOrCreateAccountingSettings(params.tenantId);
  const companyName = settings.tallyCompanyName?.trim() || '##SVCurrentCompany';

  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId: params.tenantId,
      entryDate: { gte: params.fromDate, lte: params.toDate },
      status: params.status ?? 'posted',
    },
    include: {
      lines: {
        include: { account: { select: { name: true, code: true } } },
        orderBy: { lineNo: 'asc' },
      },
    },
    orderBy: { entryDate: 'asc' },
    take: 50_000, // hard safety cap for export size
  });

  const vouchers = entries.map((je) => {
    const vchType = VALID_VOUCHER_TYPES.has(je.voucherType) ? je.voucherType : 'Journal';
    const lines = je.lines
      .map((line) => {
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const isDebit = debit > 0;
        const amount = isDebit ? -debit : credit;
        return `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(line.account.name)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
      })
      .join('');

    return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${escapeXml(vchType)}" ACTION="Create">
          <DATE>${formatTallyDate(je.entryDate)}</DATE>
          <VOUCHERTYPENAME>${escapeXml(vchType)}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(je.entryNo ?? je.id)}</VOUCHERNUMBER>
          <NARRATION>${escapeXml(je.narration ?? '')}</NARRATION>
          ${lines}
        </VOUCHER>
      </TALLYMESSAGE>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers.join('')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return { xml, voucherCount: entries.length };
}

/**
 * Tally Ledger masters export — so account names referenced by the voucher
 * export exist in Tally before vouchers are imported.
 */
export async function generateTallyLedgersXml(tenantId: string): Promise<string> {
  const settings = await getOrCreateAccountingSettings(tenantId);
  const companyName = settings.tallyCompanyName?.trim() || '##SVCurrentCompany';

  const accounts = await prisma.account.findMany({
    where: { tenantId },
    select: { name: true, code: true, classType: true },
    orderBy: { code: 'asc' },
  });

  // Map LoanTrack account classes to Tally primary groups
  const groupMap: Record<string, string> = {
    asset: 'Current Assets',
    liability: 'Current Liabilities',
    equity: 'Capital Account',
    income: 'Direct Incomes',
    expense: 'Direct Expenses',
  };

  const ledgers = accounts
    .map((a) => `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(a.name)}" ACTION="Create">
          <NAME>${escapeXml(a.name)}</NAME>
          <PARENT>${escapeXml(groupMap[a.classType] ?? 'Suspense A/c')}</PARENT>
        </LEDGER>
      </TALLYMESSAGE>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${ledgers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
