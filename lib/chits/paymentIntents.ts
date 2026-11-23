// Doc 19 — customer "I've paid" claims. Every approval flows through
// collectChitSubscriptionPayment (lib/chits/collections.ts), the single
// authoritative money-posting function — never hand-roll a second path here.
import prisma from '@/lib/db';
import { notifyUser } from '@/lib/notify/userNotify';
import { modulePath } from '@/types/modules';
import { collectChitSubscriptionPayment } from './collections';

async function assertSafeProofUrlForCustomer(
  tenantId: string,
  customerId: string,
  proofUrl: string,
) {
  const cleaned = proofUrl.trim();
  const expectedPrefix = `/api/files/${tenantId}/`;
  if (!cleaned.startsWith(expectedPrefix) || cleaned.includes('..') || cleaned.includes('\\')) {
    throw new Error('Invalid or unauthorized payment proof URL');
  }
  const suffix = cleaned.slice('/api/files/'.length);
  const [kycMatch, paymentApprovalMatch, nonIntentDoc, existingIntentDoc] = await Promise.all([
    prisma.kycDocument.findFirst({
      where: { customer: { tenantId }, filePath: { endsWith: suffix } },
      select: { id: true },
    }),
    prisma.paymentApproval.findFirst({
      where: { tenantId, photoPath: { endsWith: suffix } },
      select: { id: true },
    }),
    prisma.chitDocument.findFirst({
      where: { tenantId, entityType: { not: 'payment_intent' }, fileUrl: { endsWith: suffix } },
      select: { id: true },
    }),
    prisma.chitDocument.findFirst({
      where: { tenantId, entityType: 'payment_intent', fileUrl: { endsWith: suffix } },
      select: { entityId: true },
    }),
  ]);
  if (kycMatch || paymentApprovalMatch || nonIntentDoc) {
    throw new Error('Unauthorized file reference for payment proof');
  }
  if (existingIntentDoc) {
    const existingIntent = await prisma.chitPaymentIntent.findFirst({
      where: { id: existingIntentDoc.entityId, tenantId },
      select: { memberId: true },
    });
    if (existingIntent) {
      const existingMember = await prisma.chitMember.findUnique({
        where: { id: existingIntent.memberId },
        select: { customerId: true },
      });
      if (existingMember && existingMember.customerId !== customerId) {
        throw new Error('Unauthorized file reference for payment proof');
      }
    }
  }
}

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
  await assertSafeProofUrlForCustomer(params.tenantId, params.customerId, params.proofUrl);

  const subscription = await prisma.chitSubscription.findUnique({
    where: { id: params.subscriptionId },
    include: {
      member: { select: { id: true, customerId: true, chitGroupId: true, chitGroup: { select: { tenantId: true, branchId: true, name: true } } } },
    },
  });
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.member.customerId !== params.customerId) throw new Error('You do not own this subscription');
  if (subscription.member.chitGroup.tenantId !== params.tenantId) throw new Error('Subscription not found');
  if (subscription.status === 'paid') throw new Error('This period is already fully paid');

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
  status?: string | null;
  chitGroupId?: string | null;
}) {
  const intents = await prisma.chitPaymentIntent.findMany({
    where: {
      tenantId: params.tenantId,
      ...(params.status ? { status: params.status } : {}),
      // No role exemption (SCOPE-15): branchId is the ACTIVE branch.
      ...(params.branchId ? { branchId: params.branchId } : {}),
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
  branchId?: string | null;
  branchCode?: string | null;
  intentId: string;
  confirmedAmount: number;
  reviewerId: string;
}) {
  const out = await prisma.$transaction(async (tx) => {
    const intent = await tx.chitPaymentIntent.findUnique({ where: { id: params.intentId } });
    if (!intent || intent.tenantId !== params.tenantId) throw new Error('Payment intent not found');
    if (intent.status !== 'pending') throw new Error('This payment proof was already reviewed');

    const claimed = await tx.chitPaymentIntent.updateMany({
      where: { id: intent.id, tenantId: params.tenantId, status: 'pending' },
      data: { status: 'approving' },
    });
    if (claimed.count !== 1) throw new Error('This payment proof was already reviewed');

    const subscription = await tx.chitSubscription.findUnique({ where: { id: intent.subscriptionId } });
    if (!subscription) throw new Error('Subscription not found');
    if (subscription.status === 'paid') {
      throw new Error('This period is already fully settled — reject this intent instead');
    }
    const member = await tx.chitMember.findUnique({
      where: { id: intent.memberId },
      select: {
        chitGroup: { select: { branchId: true, chitEngineType: true } },
        customer: { select: { userId: true } },
      },
    });
    if (!member) throw new Error('Member not found');
    if (params.branchId && member.chitGroup.branchId && member.chitGroup.branchId !== params.branchId) {
      throw new Error('Payment intent not found');
    }

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
      isGoldWeightEngine: member.chitGroup.chitEngineType === 'GOLD_WEIGHT_ACCUMULATION',
    });

    await tx.chitPaymentIntent.update({
      where: { id: intent.id },
      data: { status: 'approved', reviewedById: params.reviewerId, reviewedAt: new Date(), receiptNo: result.receiptNo },
    });

    return {
      receiptNo: result.receiptNo,
      subscription: result.subscription,
      customerUserId: member.customer.userId,
    };
  });

  // Notify outside $transaction (NOTIF-1 / X-19).
  if (out.customerUserId) {
    await notifyUser({
      tenantId: params.tenantId,
      targetUserId: out.customerUserId,
      appType: 'chitfunds',
      type: 'chit_payment_approved',
      icon: 'check_circle',
      title: 'Payment approved',
      message: `Your payment was approved. Receipt ${out.receiptNo}.`,
      link: '/borrower/chits',
    }).catch(() => {});
  }

  return { receiptNo: out.receiptNo, subscription: out.subscription };
}

export async function rejectChitPaymentIntent(params: {
  tenantId: string;
  branchId?: string | null;
  intentId: string;
  reason: string;
  reviewerId: string;
}) {
  const intent = await prisma.chitPaymentIntent.findUnique({
    where: { id: params.intentId },
  });
  if (!intent || intent.tenantId !== params.tenantId) throw new Error('Payment intent not found');
  const member = await prisma.chitMember.findUnique({
    where: { id: intent.memberId },
    select: { chitGroup: { select: { branchId: true } }, customer: { select: { userId: true } } },
  });
  if (params.branchId && member?.chitGroup.branchId && member.chitGroup.branchId !== params.branchId) {
    throw new Error('Payment intent not found');
  }

  const updated = await prisma.chitPaymentIntent.updateMany({
    where: { id: intent.id, tenantId: params.tenantId, status: 'pending' },
    data: { status: 'rejected', reviewedById: params.reviewerId, reviewedAt: new Date(), rejectionReason: params.reason },
  });
  if (updated.count !== 1) throw new Error('This payment proof was already reviewed');

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
