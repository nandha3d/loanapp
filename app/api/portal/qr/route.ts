import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { randomBytes } from 'crypto';

/**
 * POST /api/portal/qr  (borrower)
 * Client generates a single-use, day-expiring QR token for the amount they will
 * pay. The agent scans it to auto-confirm the payment.
 * Body: { amount }  — applied to the loan's oldest unpaid instalment.
 */
export async function POST(req: Request) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { amount?: unknown };
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
    }

    // Oldest unpaid instalment of the borrower's loan.
    const instalment = await prisma.instalment.findFirst({
      where: {
        loanId: session.loanId,
        loan: { tenantId: session.tenantId },
        status: { notIn: ['paid', 'waived'] },
      },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      include: { loan: { select: { loanCode: true } } },
    });
    if (!instalment) {
      return NextResponse.json({ error: 'No pending instalment to pay' }, { status: 400 });
    }

    // Invalidate the borrower's previous active tokens (one live QR at a time).
    await prisma.clientPaymentToken.updateMany({
      where: { tenantId: session.tenantId, customerId: session.customerId, status: 'active' },
      data: { status: 'expired' },
    });

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999);

    await prisma.clientPaymentToken.create({
      data: {
        tenantId: session.tenantId,
        customerId: session.customerId,
        loanId: session.loanId,
        instalmentId: instalment.id,
        amount,
        token,
        status: 'active',
        expiresAt,
      },
    });

    return NextResponse.json({
      token,
      amount,
      expiresAt: expiresAt.toISOString(),
      instalmentNo: instalment.instalmentNo,
      loanCode: instalment.loan.loanCode,
      // What the agent's scanner decodes.
      payload: `loanpay:${token}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'QR generation failed' }, { status: 500 });
  }
}
