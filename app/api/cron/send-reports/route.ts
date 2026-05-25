import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/notify/channels/email';
import { getBranding, getSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Run every Monday at 8AM — email weekly report to all admin users
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
    include: {
      users: { 
        where: { role: { in: ['admin', 'superadmin'] }, status: 'active' }, 
        select: { email: true, name: true } 
      },
    },
  });

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 7);
  dateFrom.setHours(0, 0, 0, 0);

  const dateTo = new Date();
  dateTo.setHours(23, 59, 59, 999);

  const fromStr = dateFrom.toLocaleDateString('en-IN');
  const toStr = dateTo.toLocaleDateString('en-IN');

  let emailsSent = 0;

  for (const tenant of tenants) {
    const enabled = await getSetting(tenant.id, 'notify_channel_email', 'false');
    if (enabled !== 'true') continue;

    const branding = await getBranding(tenant.id);

    // Build simple HTML summary
    const [totalCollected, overdueCount] = await Promise.all([
      prisma.collectionEntry.aggregate({
        where: {
          submittedAt: { gte: dateFrom, lte: dateTo },
          collection:  { tenantId: tenant.id },
        },
        _sum: { receivedAmount: true },
      }),
      prisma.loan.count({ where: { tenantId: tenant.id, status: 'overdue' } }),
    ]);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="border-bottom:2px solid #F5A623;padding-bottom:12px;margin-bottom:20px">
          <span style="font-size:20px;font-weight:800;color:#F5A623">${branding.appName}</span>
          <span style="display:block;font-size:12px;color:#6B7280;margin-top:4px">Weekly Collection Report · ${fromStr} to ${toStr}</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:12px;background:#F0FDF4;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#27AE60">
                ₹${Number(totalCollected._sum.receivedAmount || 0).toLocaleString('en-IN')}
              </div>
              <div style="font-size:12px;color:#6B7280;margin-top:4px">Total Collected This Week</div>
            </td>
            <td style="width:16px"></td>
            <td style="padding:12px;background:#FEF2F2;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#E74C3C">${overdueCount}</div>
              <div style="font-size:12px;color:#6B7280;margin-top:4px">Overdue Loans</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#F8F9FA;border-radius:6px;font-size:13px;color:#374151">
          <a href="${process.env.AUTH_URL || 'http://localhost:3000'}/reports?from=${dateFrom.toISOString().slice(0, 10)}&to=${dateTo.toISOString().slice(0, 10)}" style="color:#F5A623;font-weight:600">
            View full report →
          </a>
        </div>
        <div style="margin-top:24px;font-size:11px;color:#9CA3AF">
          This automated report is sent every Monday. To unsubscribe, disable email notifications in Settings.
        </div>
      </div>
    `;

    for (const user of tenant.users) {
      if (!user.email) continue;
      await sendEmail(
        tenant.id,
        user.email,
        `Weekly Collection Report — ${branding.appName} (${fromStr} to ${toStr})`,
        html,
        { event: 'weekly_report' }
      );
      emailsSent++;
    }
  }

  return NextResponse.json({ ok: true, emailsSent, processedAt: new Date().toISOString() });
}
