import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { recordCollection } from '@/lib/collectionWrite';

/**
 * POST /api/portal/approvals/[id]/respond  (borrower)
 * Client approves or rejects a photo-proof payment. On approve, the verified
 * CollectionEntry is created and applied to the instalment.
 * Body: { decision: 'approve' | 'reject', reason? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { decision?: string; reason?: string };
  const decision = String(body.decision || '');
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
  }

  const approval = await prisma.paymentApproval.findFirst({
    where: { id, tenantId: session.tenantId, customerId: session.customerId, status: 'pending' },
  });
  if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });

  if (decision === 'reject') {
    await prisma.paymentApproval.update({
      where: { id: approval.id },
      data: { status: 'rejected', rejectedReason: body.reason?.slice(0, 500) || null, respondedAt: new Date() },
    });
    await prisma.systemNotification
      .create({
        data: {
          tenantId: session.tenantId,
          branchId: approval.branchId,
          appType: 'microlending',
          targetUserId: approval.agentId,
          type: 'payment_rejected',
          icon: 'cancel',
          title: 'Payment rejected by client',
          message: `Client rejected ₹${Number(approval.amount)}.`,
          link: '/collection',
        },
      })
      .catch(() => {});
    return NextResponse.json({ status: 'rejected' });
  }

  // approve
  const instalment = await prisma.instalment.findUnique({
    where: { id: approval.instalmentId },
    include: { loan: { include: { customer: true } } },
  });
  if (!instalment) return NextResponse.json({ error: 'Instalment not found' }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.paymentApproval.findUnique({ where: { id: approval.id }, select: { status: true } });
      if (!locked || locked.status !== 'pending') throw new Error('already responded');

      const rec = await recordCollection(tx, {
        tenantId: session.tenantId,
        appType: instalment.loan.appType,
        agentId: approval.agentId,
        instalment: instalment as any,
        amount: Number(approval.amount),
        paymentMode: approval.paymentMode,
        idempotencyKey: `approval:${approval.id}`,
        verificationStatus: 'verified',
        remarks: 'Photo proof (client-approved)',
      });

      await tx.paymentApproval.update({
        where: { id: approval.id },
        data: { status: 'approved', respondedAt: new Date(), collectionEntryId: rec.entryId },
      });
      return rec;
    });

    await prisma.systemNotification
      .create({
        data: {
          tenantId: session.tenantId,
          branchId: approval.branchId,
          appType: instalment.loan.appType,
          targetUserId: approval.agentId,
          type: 'payment_approved',
          icon: 'check_circle',
          title: 'Payment approved by client',
          message: `₹${result.applied} confirmed for loan ${instalment.loan.loanCode}.`,
          link: '/collection',
        },
      })
      .catch(() => {});

    return NextResponse.json({ status: 'approved', applied: result.applied });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Approval failed' }, { status: 500 });
  }
}
