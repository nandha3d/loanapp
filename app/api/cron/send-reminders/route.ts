import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notifyPaymentDueReminder } from '@/lib/sms';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find instalments due tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: tomorrow,
      status: 'upcoming',
      loan: { status: 'active' },
    },
    include: {
      loan: {
        include: {
          tenant: true,
          customer: true,
        },
      },
    },
    take: 500, // process in batches
  });

  let sent = 0;
  for (const inst of instalments) {
    const { loan } = inst;
    if (!loan.customer?.phone) continue;

    // Format date to e.g., "24 May 2026"
    const formattedDate = new Date(inst.dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    await notifyPaymentDueReminder({
      tenantId: loan.tenantId,
      phone:    loan.customer.phone,
      name:     loan.customer.name,
      amount:   Number(inst.dueAmount).toLocaleString('en-IN'),
      loanCode: loan.loanCode,
      date:     formattedDate,
      loanId:   loan.id,
    }).catch(() => {});

    sent++;
    await new Promise(r => setTimeout(r, 100)); // 100ms delay per message to respect rate limits
  }

  return NextResponse.json({ ok: true, remindersSent: sent });
}
