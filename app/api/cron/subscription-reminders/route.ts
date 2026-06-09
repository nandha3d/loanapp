import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/notify/channels/email';
import { notifyUser } from '@/lib/notify/userNotify';
import { PLAN_LABELS } from '@/lib/plans';

const PAID = ['basic', 'business', 'enterprise'];

// Daily cron. Reminds paid tenants ~1 month before their plan renews/expires
// (in-app + push to superadmins + email to owners). 1-day window so each sub is
// reminded once. Auth: `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const from = new Date();
  from.setDate(from.getDate() + 30);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const subs = await prisma.tenantSubscription.findMany({
    where: {
      plan: { in: PAID },
      status: 'active',
      currentPeriodEnd: { gte: from, lt: to },
    },
    include: {
      tenant: {
        select: {
          id: true, name: true, status: true,
          users: { where: { role: 'superadmin', status: 'active' }, select: { email: true, name: true } },
        },
      },
    },
  });

  let reminded = 0;
  for (const sub of subs) {
    if (sub.tenant?.status !== 'active') continue;
    const planLabel = PLAN_LABELS[sub.plan] || sub.plan;
    const renewDate = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    const title = 'Subscription renews in 1 month';
    const message = `Your ${planLabel} plan renews on ${renewDate}. Ensure payment to keep your features active.`;

    await notifyUser({
      tenantId: sub.tenantId,
      targetRole: 'superadmin',
      type: 'subscription_renewal',
      icon: 'event',
      title,
      message,
      link: '/portal/billing',
    });

    const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <p>Hi ${sub.tenant.users[0]?.name || 'there'},</p>
      <p>${message}</p>
      <p><a href="${base}/portal/billing" style="background:#F5A623;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Manage subscription</a></p>
    </div>`;
    for (const u of sub.tenant.users) {
      if (u.email) {
        await sendEmail(sub.tenantId, u.email, title, html, undefined, { system: true }).catch(() => {});
      }
    }
    reminded++;
  }

  return NextResponse.json({ ok: true, reminded });
}
