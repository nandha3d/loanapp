import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getBranding } from '@/lib/tenant';

// Printable A4 gold pledge receipt (HTML) — renders Tamil natively in the
// browser, no PDF font registration needed. Shop details + bilingual terms come
// from AppSetting (no hardcode). Open it then print/save as PDF.

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tenantId = await getDefaultTenantId();

  const loan = await prisma.loan.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      goldCollateral: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!loan || !loan.goldCollateral) {
    return NextResponse.json({ error: 'Gold pledge not found' }, { status: 404 });
  }

  const branding = await getBranding(tenantId);
  const [shopAddr, shopContact, licenseNo, tcEn, tcTa, sym] = await Promise.all([
    getSetting(tenantId, 'shop_address', ''),
    getSetting(tenantId, 'shop_contact', ''),
    getSetting(tenantId, 'license_no', ''),
    getSetting(tenantId, 'gold_tc_loan_en', 'Pledged ornaments are returned only on full settlement of principal and interest within the agreed term.'),
    getSetting(tenantId, 'gold_tc_loan_ta', 'கடன் தொகை மற்றும் வட்டியை குறிப்பிட்ட காலத்திற்குள் செலுத்தினால் மட்டுமே அடமானப் பொருள் திருப்பி வழங்கப்படும்.'),
    getSetting(tenantId, 'currency_symbol', '₹'),
  ]);

  const c = loan.goldCollateral;
  const fmt = (n: unknown) => `${sym}${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const wt = (n: unknown) => `${(Number(n) || 0).toFixed(3)}`;
  const itemsRows = c.items.map((it) => `
    <tr>
      <td>${esc(it.ornamentType)} ${it.specification ? `(${esc(it.specification)})` : ''}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right">${wt(it.grossWeightGrams)}</td>
      <td style="text-align:right">${wt(it.wastageGrams)}</td>
      <td style="text-align:right">${wt(it.netWeightGrams)}</td>
      <td style="text-align:right">${fmt(it.value)}</td>
    </tr>`).join('');

  const amountGiven = Number(loan.disbursed);
  const processingFee = Number(loan.deduction);
  const loanDate = new Date(loan.startDate).toLocaleDateString('en-IN');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gold Receipt ${esc(loan.loanCode)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Arial, 'Noto Sans Tamil', sans-serif; color:#1a1a1a; }
  .shop { text-align:center; border-bottom:2px solid #B8860B; padding-bottom:8px; margin-bottom:12px; }
  .shop h1 { margin:0; color:#B8860B; font-size:22px; }
  .shop .sub { font-size:12px; color:#555; }
  .meta { display:flex; justify-content:space-between; font-size:13px; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; }
  th,td { border:1px solid #ccc; padding:6px 8px; }
  th { background:#FFF8E7; color:#8B6914; text-align:left; }
  .amounts { width:55%; font-size:14px; }
  .amounts td:last-child { text-align:right; font-weight:600; }
  .tc { font-size:11px; color:#444; border-top:1px solid #ddd; padding-top:8px; margin-top:12px; }
  .tc p { margin:4px 0; }
  .sign { display:flex; justify-content:space-between; margin-top:36px; font-size:12px; }
  .print-btn { position:fixed; top:10px; right:10px; padding:8px 16px; background:#B8860B; color:#fff; border:none; border-radius:6px; cursor:pointer; }
  @media print { .print-btn { display:none; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div class="shop">
    <h1>${esc(branding.appName)}</h1>
    <div class="sub">${esc(shopAddr)} ${shopContact ? '· ' + esc(shopContact) : ''} ${licenseNo ? '· Licence: ' + esc(licenseNo) : ''}</div>
    <div style="font-weight:600; margin-top:4px;">Jewel Loan Receipt</div>
  </div>
  <div class="meta">
    <div>
      <b>Loan No:</b> ${esc(loan.loanCode)}<br>
      <b>Date:</b> ${esc(loanDate)}<br>
      <b>Packet:</b> ${esc(c.packetNo ?? '-')} · <b>Storage:</b> ${esc(c.storageLocation ?? '-')}
    </div>
    <div style="text-align:right">
      <b>Name:</b> ${esc(loan.customer?.name ?? '')}<br>
      <b>Mobile:</b> ${esc(loan.customer?.phone ?? '')}<br>
      <b>Address:</b> ${esc(loan.customer?.address ?? '')}
    </div>
  </div>
  <table>
    <thead><tr><th>Ornament</th><th>Qty</th><th>Gross (g)</th><th>Wastage (g)</th><th>Net (g)</th><th>Value</th></tr></thead>
    <tbody>${itemsRows}</tbody>
    <tfoot><tr>
      <th>Total</th>
      <th style="text-align:center">${c.items.reduce((s, i) => s + i.quantity, 0)}</th>
      <th style="text-align:right">${wt(c.grossWeightGrams)}</th>
      <th></th>
      <th style="text-align:right">${wt(c.netWeightGrams)}</th>
      <th style="text-align:right">${fmt(c.assessedValue)}</th>
    </tr></tfoot>
  </table>
  <table class="amounts">
    <tr><td>Loan Amount</td><td>${fmt(loan.principal)}</td></tr>
    <tr><td>Processing Fee</td><td>(-) ${fmt(processingFee)}</td></tr>
    <tr><td><b>Amount Given</b></td><td><b>${fmt(amountGiven)}</b></td></tr>
  </table>
  <div class="tc">
    <p>${esc(tcEn)}</p>
    <p>${esc(tcTa)}</p>
  </div>
  <div class="sign">
    <div>${esc(loan.customer?.name ?? '')}<br>(Customer Signature)</div>
    <div>Authorized Signature</div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
