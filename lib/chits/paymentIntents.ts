import { HttpError } from '@/lib/httpError';
// Doc 19 — customer "I've paid" claims. Every approval flows through
// collectChitSubscriptionPayment (lib/chits/collections.ts), the single
// authoritative money-posting function — never hand-roll a second path here.
import prisma from '@/lib/db';
import { notifyUser } from '@/lib/notify/userNotify';
import { modulePath } from '@/types/modules';
import { collectChitSubscriptionPayment } from './collections';

export async function createChitPaymentIntent(params: {
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  amount?: number | null;
  paymentMode: string;
  referenceNo?: string | null;
  proofUrl: string;
  proofFileName: string;
  proofMimeType?: string | null;
  proofSizeBytes?: number | null;
  source?: 'portal' | 'whatsapp';
}) {
  const subscription = await prisma.chitSubscription.findUnique({
    where: { id: params.subscriptionId },
    include: {
      member: { select: { id: true, customerId: true, chitGroupId: true, chitGroup: { select: { tenantId: true, branchId: true, name: true } } } },
    },
  });
  if (!subscription) throw new HttpError(404, 'Subscription not found');
  if (subscription.member.customerId !== params.customerId) throw new HttpError(404, 'Subscription not found');
  if (subscription.member.chitGroup.tenantId !== params.tenantId) throw new HttpError(404, 'Subscription not found');
  if (subscription.status === 'paid') throw new HttpError(409, 'This period is already fully paid');

  const branchId = subscription.member.chitGroup.branchId;

  const intent = await prisma.chitPaymentIntent.create({
    data: {
      tenantId: params.tenantId,
      branchId,
      memberId: subscription.memberId,
      subscriptionId: subscription.id,
      amount: params.amount ?? undefined,
      paymentMode: params.paymentMode,
      referenceNo: params.referenceNo || undefined,
      source: params.source || 'portal',
      status: 'pending',
    },
  });

  const document = await prisma.chitDocument.create({
    data: {
      tenantId: params.tenantId,
      branchId,
      appType: 'chitfunds',
      entityType: 'payment_intent',
      entityId: intent.id,
      documentType: 'payment_proof',
      fileName: params.proofFileName,
      fileUrl: params.proofUrl,
      mimeType: params.proofMimeType || undefined,
      sizeBytes: params.proofSizeBytes || undefined,
    },
  });

  await prisma.chitPaymentIntent.update({ where: { id: intent.id }, data: { proofDocumentId: document.id } });

  await notifyUser({
    tenantId: params.tenantId,
    targetRole: 'admin',
    branchId,
    appType: 'chitfunds',
    type: 'chit_payment_intent',
    icon: 'receipt_long',
    title: 'Payment proof submitted',
    message: `${subscription.member.chitGroup.name} · Period ${subscription.periodNumber} — a member submitted payment proof for review.`,
    link: modulePath('chitfunds', '/chits/payments'),
  }).catch(() => {});

  return intent;
}

export async function listMyChitPaymentIntents(customerId: string, tenantId: string) {
  const members = await prisma.chitMember.findMany({
    where: { customerId, chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null } },
    select: { id: true },
  });
  if (!members.length) return [];
  const intents = await prisma.chitPaymentIntent.findMany({
    where: { memberId: { in: members.map((m) => m.id) } },
    orderBy: { createdAt: 'desc' },
  });
  return intents.map(serializeIntent);
}

// ChitPaymentIntent.memberId/subscriptionId are plain scalars (no Prisma
// relation), matching the ChitBid.createdById convention elsewhere in this
// module — resolve member/subscription context via a separate batched
// lookup rather than an `include`.
export async function listChitPaymentIntentsForStaff(params: {
  tenantId: string;
  branchId?: string | null;
  isTenantWide: boolean;
  status?: string | null;
  chitGroupId?: string | null;
}) {
  const intents = await prisma.chitPaymentIntent.findMany({
    where: {
      tenantId: params.tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.branchId && !params.isTenantWide ? { branchId: params.branchId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!intents.length) return [];

  const memberIds = Array.from(new Set(intents.map((i) => i.memberId)));
  const subscriptionIds = Array.from(new Set(intents.map((i) => i.subscriptionId)));
  const documentIds = intents.map((i) => i.proofDocumentId).filter((id): id is string => !!id);
  const [members, subscriptions, documents] = await Promise.all([
    prisma.chitMember.findMany({
      where: { id: { in: memberIds }, ...(params.chitGroupId ? { chitGroupId: params.chitGroupId } : {}) },
      select: {
        id: true,
        ticketNo: true,
        customer: { select: { name: true, phone: true } },
        chitGroup: { select: { id: true, name: true } },
      },
    }),
    prisma.chitSubscription.findMany({
      where: { id: { in: subscriptionIds } },
      select: { id: true, periodNumber: true, dueDate: true, dueAmount: true, paidAmount: true },
    }),
    documentIds.length
      ? prisma.chitDocument.findMany({ where: { id: { in: documentIds } }, select: { id: true, fileUrl: true } })
      : Promise.resolve([]),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const subscriptionById = new Map(subscriptions.map((s) => [s.id, s]));
  const documentUrlById = new Map(documents.map((d) => [d.id, d.fileUrl]));

  // Cheap defensive duplicate-UTR check — advisory only, staff makes the call.
  const referenceNos = intents.map((i) => i.referenceNo).filter((r): r is string => !!r);
  const dupeRefs = new Set<string>();
  if (referenceNos.length) {
    const [dupIntents, dupReceipts] = await Promise.all([
      prisma.chitPaymentIntent.groupBy({
        by: ['referenceNo'],
        where: { tenantId: params.tenantId, referenceNo: { in: referenceNos } },
        _count: { referenceNo: true },
      }),
      prisma.chitReceipt.findMany({
        where: { tenantId: params.tenantId, referenceNo: { in: referenceNos } },
        select: { referenceNo: true },
      }),
    ]);
    for (const d of dupIntents) if (d.referenceNo && d._count.referenceNo > 1) dupeRefs.add(d.referenceNo);
    for (const r of dupReceipts) if (r.referenceNo) dupeRefs.add(r.referenceNo);
  }

  return intents
    .filter((i) => memberById.has(i.memberId))
    .map((i) => {
      const member = memberById.get(i.memberId)!;
      const subscription = subscriptionById.get(i.subscriptionId) || null;
      return {
        ...serializeIntent(i),
        memberName: member.customer.name,
        memberPhone: member.customer.phone,
        ticketNo: member.ticketNo,
        groupId: member.chitGroup.id,
        groupName: member.chitGroup.name,
        period: subscription
          ? {
              periodNumber: subscription.periodNumber,
              dueDate: subscription.dueDate.toISOString(),
              dueAmount: Number(subscription.dueAmount),
              paidAmount: Number(subscription.paidAmount),
            }
          : null,
        isDuplicateReference: !!i.referenceNo && dupeRefs.has(i.referenceNo),
        proofUrl: i.proofDocumentId ? documentUrlById.get(i.proofDocumentId) || null : null,
      };
    });
}

export async function approveChitPaymentIntent(params: {
  tenantId: string;
  appType: string;
  branchCode?: string | null;
  intentId: string;
  confirmedAmount: number;
  reviewerId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.chitPaymentIntent.findUnique({ where: { id: params.intentId } });
    if (!intent || intent.tenantId !== params.tenantId) throw new HttpError(404, 'Payment intent not found');
    if (intent.status !== 'pending') throw new HttpError(409, 'This payment proof was already reviewed');

    const subscription = await tx.chitSubscription.findUnique({ where: { id: intent.subscriptionId } });
    if (!subscription) throw new HttpError(404, 'Subscription not found');
    if (subscription.status === 'paid') {
      throw new HttpError(409, 'This period is already fully settled — reject this intent instead');
    }
    const member = await tx.chitMember.findUnique({
      where: { id: intent.memberId },
      select: { chitGroup: { select: { branchId: true } }, customer: { select: { userId: true } } },
    });
    if (!member) throw new HttpError(404, 'Member not found');

    const result = await collectChitSubscriptionPayment(tx, {
      tenantId: params.tenantId,
      appType: params.appType,
      branchId: member.chitGroup.branchId,
      branchCode: params.branchCode,
      subscriptionId: intent.subscriptionId,
      currentPaidAmount: Number(subscription.paidAmount),
      dueAmount: Number(subscription.dueAmount),
      amount: params.confirmedAmount,
      mode: 'ADD_PAYMENT',
      paymentMode: intent.paymentMode,
      referenceNo: intent.referenceNo,
      idempotencyKey: `chit-intent:${intent.id}`,
      collectorId: params.reviewerId,
    });

    await tx.chitPaymentIntent.update({
      where: { id: intent.id },
      data: { status: 'approved', reviewedById: params.reviewerId, reviewedAt: new Date(), receiptNo: result.receiptNo },
    });

    const customerUserId = member.customer.userId;
    if (customerUserId) {
      await notifyUser({
        tenantId: params.tenantId,
        targetUserId: customerUserId,
        appType: 'chitfunds',
        type: 'chit_payment_approved',
        icon: 'check_circle',
        title: 'Payment approved',
        message: `Your payment was approved. Receipt ${result.receiptNo}.`,
        link: '/borrower/chits',
      }).catch(() => {});
    }

    return { receiptNo: result.receiptNo, subscription: result.subscription };
  });
}

export async function rejectChitPaymentIntent(params: {
  tenantId: string;
  intentId: string;
  reason: string;
  reviewerId: string;
}) {
  const intent = await prisma.chitPaymentIntent.findUnique({ where: { id: params.intentId } });
  if (!intent || intent.tenantId !== params.tenantId) throw new HttpError(404, 'Payment intent not found');
  if (intent.status !== 'pending') throw new HttpError(409, 'This payment proof was already reviewed');

  await prisma.chitPaymentIntent.update({
    where: { id: intent.id },
    data: { status: 'rejected', reviewedById: params.reviewerId, reviewedAt: new Date(), rejectionReason: params.reason },
  });

  const member = await prisma.chitMember.findUnique({
    where: { id: intent.memberId },
    select: { customer: { select: { userId: true } } },
  });
  const customerUserId = member?.customer.userId;
  if (customerUserId) {
    await notifyUser({
      tenantId: params.tenantId,
      targetUserId: customerUserId,
      appType: 'chitfunds',
      type: 'chit_payment_rejected',
      icon: 'error',
      title: 'Payment proof rejected',
      message: params.reason || 'Your payment proof was rejected — please resubmit or contact the office.',
      link: '/borrower/chits',
    }).catch(() => {});
  }
}

function serializeIntent(i: any) {
  return {
    id: i.id,
    memberId: i.memberId,
    subscriptionId: i.subscriptionId,
    amount: i.amount != null ? Number(i.amount) : null,
    paymentMode: i.paymentMode,
    referenceNo: i.referenceNo,
    proofDocumentId: i.proofDocumentId,
    source: i.source,
    status: i.status,
    reviewedAt: i.reviewedAt ? i.reviewedAt.toISOString() : null,
    rejectionReason: i.rejectionReason,
    receiptNo: i.receiptNo,
    createdAt: i.createdAt.toISOString(),
  };
}