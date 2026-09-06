import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getTenantName } from '@/lib/tenant';
import { buildLedgerRows, summarizeLedger } from '@/lib/autofinance/ledger';

/**
 * Printable Auto Finance documents: the legal ledger sheet, the customer's
 * pocket due card, a seizing letter and the closure NOC.
 *
 * Returns self-contained HTML that opens the browser print dialog — the same
 * approach the field offices already use for receipts, and it avoids shipping
 * a PDF toolchain for four static layouts.
 */

const DOCS = ['ledger-sheet', 'due-card', 'seizing-letter', 'noc'] as const;
type DocKind = (typeof DOCS)[number];

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; doc: string }> },
) {
  const { id, doc } = await params;
  if (!DOCS.includes(doc as DocKind)) {
    return NextResponse.json({ error: 'Unknown document' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = await getDefaultTenantId();
  const loan = await prisma.loan.findFirst({
    where: { id, tenantId, appType: 'autofinance' },
    include: {
      customer: { select: { name: true, customerCode: true, phone: true, address: true } },
      vehicle: { select: { registrationNo: true, make: true, model: true, chassisNo: true, engineNo: true } },
      guarantor: { select: { name: true, phone: true } },
      autoFinanceDetail: true,
      instalments: {
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        select: {
          id: true, instalmentNo: true, dueDate: true, dueAmount: true,
          receivedAmount: true, receivedAt: true, status: true, paymentMode: true,
        },
      },
      vehicleRecoveries: {
        where: { status: 'seized' },
        orderBy: { seizedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const [tenantName, currencySymbol] = await Promise.all([
    getTenantName(tenantId),
    getSetting(tenantId, 'currency_symbol', '₹'),
  ]);

  // Accepts Prisma Decimal as well as plain numbers.
  const money = (n: number | { toString(): string }) =>
    `${currencySymbol}${Math.round(Number(n)).toLocaleString('en-IN')}`;

  const financed = loan.autoFinanceDetail?.vehicleValue != null && loan.autoFinanceDetail?.downPayment != null
    ? Number(loan.autoFinanceDetail.vehicleValue) - Number(loan.autoFinanceDetail.downPayment)
    : Number(loan.principal);
  const principalPer = financed / (loan.instalments.length || 1);

  const rows = buildLedgerRows(loan.instalments.map((i) => {
    const due = Number(i.dueAmount);
    return {
      id: i.id,
      instalmentNo: i.instalmentNo,
      dueDate: i.dueDate,
      dueAmount: due,
      receivedAmount: Number(i.receivedAmount),
      receivedAt: i.receivedAt,
      status: i.status,
      paymentMode: i.paymentMode,
      principalComponent: Math.min(due, principalPer),
      interestComponent: Math.max(0, due - principalPer),
    };
  }));
  const totals = summarizeLedger(rows);

  const vehicleLine = loan.vehicle
    ? `${loan.vehicle.registrationNo} — ${loan.vehicle.make} ${loan.vehicle.model}`
    : '—';

  const header = `
    <header>
      <h1>${esc(tenantName)}</h1>
      <div class="meta">
        <span><b>Account</b> ${esc(loan.loanCode)}</span>
        <span><b>Customer</b> ${esc(loan.customer.name)} (${esc(loan.customer.customerCode)})</span>
        <span><b>Vehicle</b> ${esc(vehicleLine)}</span>
        <span><b>Phone</b> ${esc(loan.customer.phone)}</span>
      </div>
    </header>`;

  let title = '';
  let body = '';

  if (doc === 'ledger-sheet') {
    title = 'Legal Ledger Sheet';
    body = `
      ${header}
      <h2>Legal Ledger Sheet</h2>
      <table>
        <thead><tr>
          <th>#</th><th>Due Date</th><th>Paid Date</th><th>Mode</th>
          <th class="r">Principal</th><th class="r">Interest</th><th class="r">Amount</th><th class="r">Balance</th>
        </tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="${r.tone}">
              <td>${r.instalmentNo}${r.isSplit ? ` <em>(${r.segment})</em>` : ''}</td>
              <td>${fmtDate(r.dueDate)}</td>
              <td>${r.paidDate ? fmtDate(r.paidDate) : '—'}</td>
              <td>${esc(r.paymentMode ?? '—')}</td>
              <td class="r">${money(r.principal)}</td>
              <td class="r">${money(r.interest)}</td>
              <td class="r"><b>${money(r.amount)}</b></td>
              <td class="r">${money(r.runningBalance)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <span>Collected <b>${money(totals.totalPaid)}</b></span>
        <span>Overdue <b>${money(totals.totalOverdue)}</b></span>
        <span>Upcoming <b>${money(totals.totalUpcoming)}</b></span>
      </div>
      <div class="sign"><span>Authorised Signatory</span><span>Customer</span></div>`;
  }

  if (doc === 'due-card') {
    title = 'Due Card';
    body = `
      <div class="card-print">
        <h2>${esc(tenantName)}</h2>
        <div class="row"><b>A/c</b> ${esc(loan.loanCode)}</div>
        <div class="row"><b>Name</b> ${esc(loan.customer.name)}</div>
        <div class="row"><b>Vehicle</b> ${esc(vehicleLine)}</div>
        <div class="row"><b>EMI</b> ${money(loan.perInstalment)} × ${loan.totalInstalments}</div>
        <table class="mini">
          <thead><tr><th>#</th><th>Due</th><th>Paid</th><th>Sign</th></tr></thead>
          <tbody>
            ${loan.instalments.map((i) => `
              <tr>
                <td>${i.instalmentNo}</td>
                <td>${fmtDate(i.dueDate)}</td>
                <td>${Number(i.receivedAmount) > 0 ? money(i.receivedAmount) : ''}</td>
                <td></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (doc === 'seizing-letter') {
    const recovery = loan.vehicleRecoveries[0];
    title = 'Seizing Letter';
    body = `
      ${header}
      <h2>Notice of Seizure</h2>
      <p>Dear ${esc(loan.customer.name)},</p>
      <p>
        Under the hire-purchase agreement for account <b>${esc(loan.loanCode)}</b> covering
        vehicle <b>${esc(vehicleLine)}</b>${loan.vehicle?.chassisNo ? ` (chassis ${esc(loan.vehicle.chassisNo)})` : ''},
        an amount of <b>${money(totals.totalOverdue + totals.totalPenalty)}</b> is overdue as of
        ${fmtDate(new Date())}.
      </p>
      ${recovery ? `
        <p>
          The vehicle was taken into possession on <b>${fmtDate(recovery.seizedAt)}</b> and is held at
          <b>${esc(recovery.yardLocation)}</b>. Seizing charges of <b>${money(recovery.seizingCharges)}</b> apply.
        </p>` : `
        <p>
          Unless the arrears are cleared within seven (7) days of this notice, the vehicle will be
          taken into possession as provided for in the agreement.
        </p>`}
      <p>To release the vehicle, clear the arrears together with the applicable seizing charges.</p>
      <div class="sign"><span>Authorised Signatory</span><span>Received by</span></div>`;
  }

  if (doc === 'noc') {
    const cleared = loan.status === 'closed';
    title = 'No Objection Certificate';
    body = `
      ${header}
      <h2>No Objection Certificate</h2>
      ${cleared ? `
        <p>
          This is to certify that ${esc(loan.customer.name)} has repaid in full all amounts due under
          hire-purchase account <b>${esc(loan.loanCode)}</b> in respect of vehicle
          <b>${esc(vehicleLine)}</b>${loan.vehicle?.engineNo ? ` (engine ${esc(loan.vehicle.engineNo)})` : ''}.
        </p>
        <p>
          We have <b>no objection</b> to the removal of our hypothecation from the registration
          certificate of the said vehicle. Account closed on ${fmtDate(loan.closedAt)}.
        </p>` : `
        <p class="warn">
          This account is <b>not yet closed</b>. An outstanding balance of
          <b>${money(totals.totalOverdue + totals.totalUpcoming)}</b> remains.
          An NOC cannot be issued until the account is settled in full.
        </p>`}
      <div class="sign"><span>Authorised Signatory</span><span></span></div>`;
  }

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(title)} — ${esc(loan.loanCode)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #111; font-size: 12px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  h2 { font-size: 15px; margin: 16px 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  .meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; font-size: 11px; }
  .r { text-align: right; }
  tr.overdue { background: #fde8e8; }
  tr.upcoming { background: #e8f7ec; }
  .totals { display: flex; gap: 20px; margin-top: 12px; font-size: 12px; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 11px; }
  .sign span { border-top: 1px solid #111; padding-top: 4px; min-width: 180px; text-align: center; }
  .warn { color: #b91c1c; font-weight: 600; }
  p { line-height: 1.6; }
  .card-print { width: 320px; border: 2px solid #111; padding: 12px; }
  .card-print h2 { margin: 0 0 8px; font-size: 14px; text-align: center; }
  .card-print .row { font-size: 11px; margin-bottom: 3px; }
  table.mini th, table.mini td { padding: 2px 4px; font-size: 10px; }
  @media print { body { margin: 0; } .noprint { display: none; } }
</style></head>
<body>
${body}
<script>window.addEventListener('load', () => window.print());</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
