import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { recordCollection } from '@/lib/collectionWrite';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { getCollectionSubmissionBlockReason } from '@/lib/collectionPolicy';
import { getTenantRazorpayConfig } from '@/lib/tenantRazorpay';

/**
 * mCollect-B — digital self-pay (UPI / link).
 *
 * A borrower pays their own instalment through a PSP payment link / QR. The
 * money lands in the company bank, so reconciliation posts a CollectionEntry
 * tagged `self_pay_upi` WITHOUT crediting any agent's cash float. Built on the
 * existing ClientPaymentToken so the legacy agent-scan QR flow is untouched.
 */

const PUBLIC_BASE = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || '';

export type SelfPayLink = {
  token: string;
  amount: number;
  payUrl: string;
  qrPayload: string;
  expiresAt: string;
  instalmentNo: number;
  loanCode: string;
  mock: boolean;
};

/** Outstanding for an instalment (capped at >= 0). */
function outstandingOf(dueAmount: unknown, receivedAmount: unknown): number {
  return Math.max(0, Number(dueAmount) - Number(receivedAmount || 0));
}

/**
 * Creates (or replaces) a self-pay link for an instalment. If `instalmentId` is
 * omitted, targets the loan's oldest unpaid instalment. Invalidates the
 * customer's previous active tokens so only one live link exists at a time.
 */
export async function createSelfPayLink(input: {
  tenantId: string;
  loanId?: string;
  instalmentId?: string;
  amount?: number;
  channel?: string;
  ttlHours?: number;
}): Promise<SelfPayLink> {
  let instalment = input.instalmentId
    ? await prisma.instalment.findUnique({
        where: { id: input.instalmentId },
        include: { loan: { include: { customer: { select: { id: true, name: true, phone: true } } } } },
      })
    : null;

  if (!instalment && input.loanId) {
    instalment = await prisma.instalment.findFirst({
      where: { loanId: input.loanId, status: { notIn: ['paid', 'waived'] } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      include: { loan: { include: { customer: { select: { id: true, name: true, phone: true } } } } },
    });
  }

  if (!instalment || instalment.loan.tenantId !== input.tenantId) {
    throw new Error('instalment_not_found');
  }

  const block = getCollectionSubmissionBlockReason({
    loanStatus: instalment.loan.status,
    dueAmount: Number(instalment.dueAmount),
    receivedAmount: Number(instalment.receivedAmount || 0),
  });
  if (block) throw new Error(block);

  const outstanding = outstandingOf(instalment.dueAmount, instalment.receivedAmount);
  const amount = input.amount && input.amount > 0 ? Math.min(input.amount, outstanding) : outstanding;
  if (amount <= 0) throw new Error('nothing_due');

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (input.ttlHours ?? 48));

  // Use the TENANT's own Razorpay account so the repayment settles into the
  // lender's bank. No gateway configured -> internal hosted UPI page fallback.
  const gateway = await getTenantRazorpayConfig(input.tenantId);
  const link = await createRazorpayPaymentLink({
    token,
    amount,
    description: `Loan ${instalment.loan.loanCode} · instalment #${instalment.instalmentNo}`,
    tenantId: input.tenantId,
    keyId: gateway.enabled ? gateway.keyId : null,
    keySecret: gateway.enabled ? gateway.keySecret : null,
    customerName: instalment.loan.customer.name,
    customerPhone: instalment.loan.customer.phone,
    callbackUrl: `${PUBLIC_BASE}/borrower/pay`,
  });

  await prisma.$transaction([
    prisma.clientPaymentToken.updateMany({
      where: {
        tenantId: input.tenantId,
        customerId: instalment.loan.customer.id,
        instalmentId: instalment.id,
        status: 'active',
      },
      data: { status: 'expired' },
    }),
    prisma.clientPaymentToken.create({
      data: {
        tenantId: input.tenantId,
        customerId: instalment.loan.customer.id,
        loanId: instalment.loanId,
        instalmentId: instalment.id,
        amount,
        token,
        status: 'active',
        channel: input.channel ?? 'upi',
        payUrl: link.shortUrl,
        providerRef: link.id,
        expiresAt,
      },
    }),
  ]);

  return {
    token,
    amount,
    payUrl: link.shortUrl,
    qrPayload: link.shortUrl,
    expiresAt: expiresAt.toISOString(),
    instalmentNo: instalment.instalmentNo,
    loanCode: instalment.loan.loanCode,
    mock: link.mock,
  };
}

export type SelfPayReconcileResult = {
  status: 'paid' | 'already_paid' | 'invalid';
  entryId?: string;
  applied?: number;
};

/**
 * Reconciles a captured payment to its self-pay token: posts a verified
 * CollectionEntry (`self_pay_upi`, no agent float credit) and marks the token
 * paid. Idempotent — a token already `paid`/`used` returns without double-posting.
 * Resolve the token by `token` or by PSP `providerRef` (from webhook notes/link id).
 */
export async function reconcileSelfPayToken(input: {
  token?: string;
  providerRef?: string;
  paidAmount?: number; // rupees actually captured (optional cross-check)
  agentId?: string | null; // optional attribution; pass null for pure self-pay
}): Promise<SelfPayReconcileResult> {
  const tok = input.token
    ? await prisma.clientPaymentToken.findUnique({ where: { token: input.token } })
    : input.providerRef
      ? await prisma.clientPaymentToken.findFirst({ where: { providerRef: input.providerRef } })
      : null;

  if (!tok) return { status: 'invalid' };
  if (tok.status === 'paid' || tok.status === 'used') {
    return { status: 'already_paid', entryId: tok.collectionEntryId ?? undefined };
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: tok.instalmentId },
    include: { loan: { include: { customer: { select: { id: true, routeId: true, agentId: true } } } } },
  });
  if (!instalment || instalment.loan.tenantId !== tok.tenantId) return { status: 'invalid' };

  const amount = input.paidAmount && input.paidAmount > 0 ? input.paidAmount : Number(tok.amount);

  // CollectionEntry.agentId is a real User FK — resolve a valid actor. For pure
  // self-pay (webhook, no agent) fall back to the loan's creator, then the
  // customer's assigned agent, then any active admin/owner of the tenant.
  let resolvedAgentId = input.agentId ?? instalment.loan.createdById ?? instalment.loan.customer.agentId ?? null;
  if (!resolvedAgentId) {
    const fallback = await prisma.user.findFirst({
      where: { tenantId: tok.tenantId, status: 'active', role: { in: ['admin', 'superadmin', 'owner', 'developer'] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    resolvedAgentId = fallback?.id ?? null;
  }
  if (!resolvedAgentId) return { status: 'invalid' };

  const result = await prisma.$transaction(async (tx) => {
    // Re-lock inside the tx to prevent double-spend on concurrent webhook + scan.
    const locked = await tx.clientPaymentToken.findUnique({
      where: { id: tok.id },
      select: { status: true },
    });
    if (!locked || locked.status === 'paid' || locked.status === 'used') {
      return { status: 'already_paid' as const, entryId: tok.collectionEntryId ?? undefined };
    }

    const rec = await recordCollection(tx, {
      tenantId: tok.tenantId,
      appType: instalment.loan.appType,
      // Resolved to a real User above. Never credits float (self-pay = bank money).
      agentId: resolvedAgentId,
      instalment: {
        id: instalment.id,
        loanId: instalment.loanId,
        instalmentNo: instalment.instalmentNo,
        dueAmount: instalment.dueAmount,
        receivedAmount: instalment.receivedAmount,
        loan: {
          customerId: instalment.loan.customerId,
          branchId: instalment.loan.branchId,
          customer: { routeId: instalment.loan.customer.routeId },
        },
      },
      amount,
      paymentMode: 'upi',
      idempotencyKey: `selfpay:${tok.token}`,
      verificationStatus: 'verified',
      remarks: 'Self-pay (digital, auto-reconciled)',
      source: 'self_pay_upi',
      creditFloat: false,
    });

    await tx.clientPaymentToken.update({
      where: { id: tok.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        usedAt: new Date(),
        collectionEntryId: rec.entryId,
        providerRef: input.providerRef ?? tok.providerRef,
      },
    });

    return { status: 'paid' as const, entryId: rec.entryId, applied: rec.applied };
  });

  return result;
}

/**
 * Tier-0 claim: borrower reports they have paid via UPI (no PSP webhook to trust),
 * so we DON'T post money — we mark the token `claimed` and surface it in the
 * verification queue for one-tap staff confirmation. Idempotent & safe.
 */
export async function claimSelfPayToken(token: string): Promise<{ status: string }> {
  const tok = await prisma.clientPaymentToken.findUnique({ where: { token } });
  if (!tok) return { status: 'invalid' };
  if (tok.status === 'paid' || tok.status === 'used') return { status: 'already_paid' };
  if (tok.expiresAt.getTime() < Date.now()) {
    await prisma.clientPaymentToken.update({ where: { id: tok.id }, data: { status: 'expired' } });
    return { status: 'expired' };
  }
  if (tok.status !== 'claimed') {
    await prisma.clientPaymentToken.update({ where: { id: tok.id }, data: { status: 'claimed' } });
  }
  return { status: 'claimed' };
}

/** Verification queue: self-pay tokens awaiting staff confirmation. */
export async function listPendingSelfPay(tenantId: string, branchId?: string | null) {
  const tokens = await prisma.clientPaymentToken.findMany({
    where: { tenantId, status: { in: ['claimed', 'active'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  if (tokens.length === 0) return [];

  const loanIds = [...new Set(tokens.map((t) => t.loanId))];
  const customerIds = [...new Set(tokens.map((t) => t.customerId))];
  const [loans, customers] = await Promise.all([
    prisma.loan.findMany({
      where: { id: { in: loanIds }, ...(branchId ? { branchId } : {}) },
      select: { id: true, loanCode: true, branchId: true },
    }),
    prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, customerCode: true },
    }),
  ]);
  const loanMap = new Map(loans.map((l) => [l.id, l]));
  const custMap = new Map(customers.map((c) => [c.id, c]));

  return tokens
    .filter((t) => loanMap.has(t.loanId)) // branch scope
    .map((t) => {
      const c = custMap.get(t.customerId);
      return {
        token: t.token,
        amount: Number(t.amount),
        status: t.status,
        channel: t.channel,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
        loanCode: loanMap.get(t.loanId)?.loanCode ?? '',
        customerName: c?.name ?? '',
        customerCode: c?.customerCode ?? '',
        phone: c?.phone ?? '',
      };
    });
}

/** Staff rejects a claimed self-pay token (e.g. money never arrived). */
export async function rejectSelfPayToken(token: string): Promise<{ status: string }> {
  const tok = await prisma.clientPaymentToken.findUnique({ where: { token } });
  if (!tok) return { status: 'invalid' };
  if (tok.status === 'paid' || tok.status === 'used') return { status: 'already_paid' };
  await prisma.clientPaymentToken.update({ where: { id: tok.id }, data: { status: 'failed' } });
  return { status: 'rejected' };
}
