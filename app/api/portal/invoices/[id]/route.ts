import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import prisma from '@/lib/db';
import { formatDate } from '@/lib/utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const tenantId = await getDefaultTenantId();

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id, tenantId },
    include: { tenant: true },
  });

  if (!invoice) {
    return new NextResponse('Invoice not found', { status: 404 });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${invoice.id}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .header h1 { margin: 0; color: #111; }
        .details { margin-bottom: 40px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; }
        .table th { background: #fafafa; }
        .totals { margin-top: 20px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div>
            <h1>INVOICE</h1>
            <p>Date: ${formatDate(invoice.createdAt)}<br>
            Invoice #: ${invoice.id}</p>
          </div>
          <div style="text-align: right;">
            <strong>LoanTrack Solutions</strong><br>
            billing@loantrack.app
          </div>
        </div>
        <div class="details">
          <strong>Billed To:</strong><br>
          ${invoice.tenant.name}<br>
          ${invoice.tenant.slug}.loantrack.app
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>LoanTrack Subscription - Monthly</td>
              <td style="text-align: right;">${Number(invoice.amount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="totals">
          <p>Subtotal: ${Number(invoice.amount).toFixed(2)}</p>
          <p>Tax (18%): ${Number(invoice.tax).toFixed(2)}</p>
          <h2>Total: ${Number(invoice.total).toFixed(2)} INR</h2>
        </div>
        <p style="text-align: center; margin-top: 40px; color: #777;">Thank you for your business!</p>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
