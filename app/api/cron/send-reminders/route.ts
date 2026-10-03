import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notify } from '@/lib/notify/events';
import { dayKey, outstandingOf, sendInstalmentDigests } from '@/lib/notify/staffAlerts';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date();
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Fetch all upcoming instalments due tomorrow
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
      status:  'upcoming',
      loan: { status: 'active' },
    },
    include: {
      loan: {
        include: {
          customer: { select: { name: true, phone: true, email: true, agentId: true } },
        },
      },
    },
    take: 1000, // process max 1000 per run; add pagination for larger tenants
  });

  let sent = 0;
  for (const inst of instalments) {
    const { loan } = inst;
    if (!loan.customer?.phone) continue;

    const day = String(inst.dueDate.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[inst.dueDate.getMonth()];
    const year = inst.dueDate.getFullYear();
    const formattedDate = `${day} ${month} ${year}`;

    await notify({
      tenantId: loan.tenantId,
      event:    'payment_due_reminder',
      phone:    loan.customer.phone,
      email:    loan.customer.email ?? undefined,
      data: {
        name:     loan.customer.name,
        amount:   Number(inst.dueAmount).toLocaleString('en-IN'),
        loanCode: loan.loanCode,
        date:     formattedDate,
      },
      meta: { entityType: 'instalment', entityId: inst.id },
    });

    sent++;
    // Throttle: 100ms between messages to respect provider rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Staff digests (agent / branch admins / superadmins): EMIs due tomorrow and
  // today. Independent of the customer SMS above; never fails the cron.
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const dueToday = await prisma.instalment.findMany({
      where: {
        dueDate: { gte: todayStart, lte: todayEnd },
        status: 'upcoming',
        loan: { status: 'active' },
      },
      select: {
        dueAmount: true,
        receivedAmount: true,
        loan: {
          select: {
            tenantId: true, appType: true, branchId: true,
            customer: { select: { agentId: true } },
          },
        },
      },
      take: 5000,
    });
    const asRows = (list: Array<{ dueAmount: unknown; receivedAmount: unknown; loan: any }>) =>
      list.map((i) => ({ amount: outstandingOf(i.dueAmount, i.receivedAmount), loan: i.loan }));
    await sendInstalmentDigests('emi_due_tomorrow', asRows(instalments), dayKey(tomorrowStart));
    await sendInstalmentDigests('emi_due_today', asRows(dueToday), dayKey(todayStart));
  } catch (err) {
    console.error('[send-reminders] staff digests failed', err);
  }

  return NextResponse.json({ ok: true, remindersSent: sent, processedAt: new Date().toISOString() });
}
