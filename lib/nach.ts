/**
 * e-NACH / e-Mandate service (Razorpay).
 *
 * Flow:
 *   1. createMandate()      → Razorpay customer + order → auth link sent to borrower
 *   2. borrower authorises  → Razorpay fires payment.authorized webhook
 *   3. confirmMandate()     → mandate status → active, token stored
 *   4. presentPayment()     → recurring charge per EMI (cron D-2 or manual)
 *   5. handlePresentation() → success → CollectionEntry; failure → bounce record
 *   6. cancelMandate()      → cancels at Razorpay + marks DB cancelled
 */

import prisma from '@/lib/db';
import { getTenantRazorpayConfig } from '@/lib/tenantRazorpay';
import { submitCollectionEntry } from '@/lib/collectionWrite';
import { Decimal } from '@prisma/client/runtime/library';
import { getSetting } from '@/lib/tenant';
import { getCurrencyCode } from '@/lib/currency';

// ── Tenant-configurable NACH parameters (AppSetting keys) ─────────────────────

export type NachConfig = {
  /** Max retry attempts after a bounce before status becomes `bounced` */
  maxRetries: number;
  /** Days between retry attempts (multiplied by attempt number: D+2, D+4 …) */
  retryIntervalDays: number;
  /** Present the debit N days before the instalment due date */
  presentDaysBefore: number;
};

const NACH_DEFAULTS: NachConfig = { maxRetries: 3, retryIntervalDays: 2, presentDaysBefore: 2 };

export async function getNachConfig(tenantId: string): Promise<NachConfig> {
  const [maxRetries, retryIntervalDays, presentDaysBefore] = await Promise.all([
    getSetting(tenantId, 'nach_max_retries', String(NACH_DEFAULTS.maxRetries)),
    getSetting(tenantId, 'nach_retry_interval_days', String(NACH_DEFAULTS.retryIntervalDays)),
    getSetting(tenantId, 'nach_present_days_before', String(NACH_DEFAULTS.presentDaysBefore)),
  ]);
  return {
    maxRetries: parseInt(maxRetries, 10) || NACH_DEFAULTS.maxRetries,
    retryIntervalDays: parseInt(retryIntervalDays, 10) || NACH_DEFAULTS.retryIntervalDays,
    presentDaysBefore: parseInt(presentDaysBefore, 10) || NACH_DEFAULTS.presentDaysBefore,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateMandateInput = {
  tenantId: string;
  loanId: string;
  customerId: string;
  createdById: string;
  accountHolderName: string;
  accountNumber: string;
  accountType: 'savings' | 'current';
  ifscCode: string;
  bankName?: string;
  maxAmount: number; // ₹ — upper cap for any single debit
  authType?: 'netbanking' | 'debitcard' | 'aadhaar';
  customerPhone?: string;
  customerEmail?: string;
};

export type NachPresentInput = {
  mandateId: string;
  instalmentId: string;
  amount: number; // ₹
  description?: string;
};

// ── Razorpay helpers ──────────────────────────────────────────────────────────

function rzpAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function rzpPost(url: string, body: unknown, auth: string) {
  const res = await fetch(`https://api.razorpay.com/v1${url}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Razorpay ${url} failed: ${JSON.stringify(data)}`);
  return data;
}

async function rzpDelete(url: string, auth: string) {
  const res = await fetch(`https://api.razorpay.com/v1${url}`, {
    method: 'DELETE',
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Razorpay DELETE ${url} failed: ${JSON.stringify(data)}`);
  }
}

// ── Core service ──────────────────────────────────────────────────────────────

/**
 * Register an e-mandate for a loan. Returns the auth link to share with the borrower.
 * Status starts as `pending_auth`; moves to `active` on webhook confirmation.
 */
export async function createMandate(input: CreateMandateInput) {
  const gw = await getTenantRazorpayConfig(input.tenantId);
  if (!gw.keyId || !gw.keySecret) {
    throw new Error('Tenant Razorpay gateway not configured. Set key id + secret in Settings → Payment Gateway.');
  }

  const auth = rzpAuth(gw.keyId, gw.keySecret);
  const authType = input.authType ?? 'netbanking';
  const currency = await getCurrencyCode(input.tenantId);

  // 1 — Ensure Razorpay customer exists
  const rzpCustomer = await rzpPost('/customers', {
    name: input.accountHolderName,
    contact: input.customerPhone ?? '',
    email: input.customerEmail ?? '',
    fail_existing: 0,
  }, auth);

  // 2 — Create recurring order (amount = 0 for auth-only registration)
  const order = await rzpPost('/orders', {
    amount: 0,
    currency,
    method: 'emandate',
    auth_type: authType,
    bank_account: {
      beneficiary_name: input.accountHolderName,
      account_number: input.accountNumber,
      account_type: input.accountType,
      ifsc_code: input.ifscCode,
    },
    recurring: 1,
    customer_id: rzpCustomer.id,
    notes: { loan_id: input.loanId, tenant_id: input.tenantId },
  }, auth);

  // 3 — Persist mandate
  const mandate = await prisma.nachMandate.create({
    data: {
      tenantId: input.tenantId,
      loanId: input.loanId,
      customerId: input.customerId,
      createdById: input.createdById,
      razorpayCustomerId: rzpCustomer.id,
      razorpayOrderId: order.id,
      authType,
      accountHolderName: input.accountHolderName,
      accountNumber: input.accountNumber,
      accountType: input.accountType,
      ifscCode: input.ifscCode,
      bankName: input.bankName ?? null,
      maxAmount: new Decimal(input.maxAmount),
      status: 'pending_auth',
    },
  });

  // 4 — Return Razorpay order id so frontend can open checkout
  return {
    mandateId: mandate.id,
    razorpayOrderId: order.id,
    razorpayCustomerId: rzpCustomer.id,
    razorpayKeyId: gw.keyId,
  };
}

/**
 * Called from webhook when Razorpay fires `payment.authorized` for an e-mandate.
 * Stores the token and flips status to `active`.
 */
export async function confirmMandate(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpayTokenId: string;
}) {
  const mandate = await prisma.nachMandate.findFirst({
    where: { razorpayOrderId: params.razorpayOrderId },
  });
  if (!mandate) return null;

  return prisma.nachMandate.update({
    where: { id: mandate.id },
    data: {
      razorpayTokenId: params.razorpayTokenId,
      razorpayPaymentId: params.razorpayPaymentId,
      status: 'active',
      activatedAt: new Date(),
    },
  });
}

/**
 * Called from webhook when Razorpay fires `payment.failed` during mandate auth.
 */
export async function rejectMandate(params: {
  razorpayOrderId: string;
  reason?: string;
}) {
  const mandate = await prisma.nachMandate.findFirst({
    where: { razorpayOrderId: params.razorpayOrderId },
  });
  if (!mandate) return null;

  return prisma.nachMandate.update({
    where: { id: mandate.id },
    data: {
      status: 'rejected',
      rejectionReason: params.reason ?? 'Authorization declined by bank',
    },
  });
}

/**
 * Present (debit) one instalment via the active mandate.
 * Creates a NachPresentation record and a Razorpay recurring payment.
 * Call D-2 before due date to allow settlement time.
 */
export async function presentPayment(input: NachPresentInput) {
  const mandate = await prisma.nachMandate.findUnique({
    where: { id: input.mandateId },
    include: { loan: { include: { customer: true } } },
  });
  if (!mandate) throw new Error('Mandate not found');
  if (mandate.status !== 'active') throw new Error(`Mandate not active (status: ${mandate.status})`);
  if (!mandate.razorpayTokenId || !mandate.razorpayCustomerId) {
    throw new Error('Mandate token not set — authorization incomplete');
  }
  if (new Decimal(input.amount).gt(mandate.maxAmount)) {
    throw new Error(`Amount ₹${input.amount} exceeds mandate max ₹${mandate.maxAmount}`);
  }

  const gw = await getTenantRazorpayConfig(mandate.tenantId);
  if (!gw.keyId || !gw.keySecret) throw new Error('Tenant gateway not configured');
  const auth = rzpAuth(gw.keyId, gw.keySecret);
  const currency = await getCurrencyCode(mandate.tenantId);

  // Create new order for this recurring charge
  const order = await rzpPost('/orders', {
    amount: Math.round(input.amount * 100),
    currency,
    method: 'emandate',
    recurring: 1,
    customer_id: mandate.razorpayCustomerId,
    token: mandate.razorpayTokenId,
    notes: {
      loan_id: mandate.loanId,
      instalment_id: input.instalmentId,
      tenant_id: mandate.tenantId,
    },
  }, auth);

  // Trigger the charge
  const payment = await rzpPost('/payments/create/recurring', {
    email: mandate.loan.customer.email ?? '',
    contact: mandate.loan.customer.phone,
    amount: Math.round(input.amount * 100),
    currency,
    order_id: order.id,
    customer_id: mandate.razorpayCustomerId,
    token: mandate.razorpayTokenId,
    recurring: '1',
    description: input.description ?? `EMI debit – Loan ${mandate.loanId}`,
    notes: {
      loan_id: mandate.loanId,
      instalment_id: input.instalmentId,
      tenant_id: mandate.tenantId,
    },
  }, auth);

  const presentation = await prisma.nachPresentation.create({
    data: {
      mandateId: mandate.id,
      instalmentId: input.instalmentId,
      loanId: mandate.loanId,
      tenantId: mandate.tenantId,
      razorpayOrderId: order.id,
      razorpayPaymentId: payment.id ?? null,
      amount: new Decimal(input.amount),
      status: 'submitted',
    },
  });

  return { presentationId: presentation.id, razorpayPaymentId: payment.id };
}

/**
 * Webhook: `payment.captured` for a NACH recurring payment → create CollectionEntry.
 */
export async function handlePresentationSuccess(params: {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number; // paise
}) {
  const amountRupees = params.amount / 100;

  const presentation = await prisma.nachPresentation.findFirst({
    where: { razorpayPaymentId: params.razorpayPaymentId },
    include: { mandate: { include: { loan: true } } },
  });
  if (!presentation) return null;
  if (presentation.status === 'success') return presentation; // idempotent

  const { mandate } = presentation;
  const loan = mandate.loan;

  // Use shared collection-write logic
  if (presentation.instalmentId) {
    const { entry } = await submitCollectionEntry(
      {
        tenantId: loan.tenantId,
        appType: loan.appType,
        userId: 'system',
        branchId: loan.branchId ?? null,
        role: 'admin',
      },
      {
        instalmentId: presentation.instalmentId,
        receivedAmount: amountRupees,
        paymentMode: 'nach_auto_debit',
        remarks: `Auto-debit via e-NACH mandate ${mandate.id}`,
        idempotencyKey: `nach_${presentation.id}`,
      },
    );

    await prisma.nachPresentation.update({
      where: { id: presentation.id },
      data: {
        status: 'success',
        settledAt: new Date(),
        collectionEntryId: entry.id,
      },
    });
  }

  return presentation;
}

/**
 * Webhook: `payment.failed` for a NACH recurring payment → bounce record.
 */
export async function handlePresentationFailure(params: {
  razorpayPaymentId: string;
  errorCode?: string;
  errorDescription?: string;
}) {
  const presentation = await prisma.nachPresentation.findFirst({
    where: { razorpayPaymentId: params.razorpayPaymentId },
  });
  if (!presentation) return null;

  const config = await getNachConfig(presentation.tenantId);
  const retryCount = presentation.retryCount + 1;
  const nextRetryAt = retryCount < config.maxRetries
    ? new Date(Date.now() + retryCount * config.retryIntervalDays * 24 * 60 * 60 * 1000)
    : null;

  return prisma.nachPresentation.update({
    where: { id: presentation.id },
    data: {
      status: retryCount >= config.maxRetries ? 'bounced' : 'failed',
      failureCode: params.errorCode ?? null,
      failureReason: params.errorDescription ?? null,
      retryCount,
      nextRetryAt,
    },
  });
}

/**
 * Cancel an active mandate — both at Razorpay and in DB.
 */
export async function cancelMandate(params: {
  mandateId: string;
  cancelledById: string;
  reason?: string;
}) {
  const mandate = await prisma.nachMandate.findUnique({ where: { id: params.mandateId } });
  if (!mandate) throw new Error('Mandate not found');
  if (['cancelled', 'rejected'].includes(mandate.status)) {
    throw new Error(`Mandate already ${mandate.status}`);
  }

  if (mandate.razorpayTokenId) {
    const gw = await getTenantRazorpayConfig(mandate.tenantId);
    if (gw.keyId && gw.keySecret) {
      const auth = rzpAuth(gw.keyId, gw.keySecret);
      await rzpDelete(
        `/customers/${mandate.razorpayCustomerId}/tokens/${mandate.razorpayTokenId}`,
        auth,
      ).catch((e) => console.warn('[nach] Razorpay token delete failed:', e.message));
    }
  }

  return prisma.nachMandate.update({
    where: { id: params.mandateId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledById: params.cancelledById,
      cancelReason: params.reason ?? null,
    },
  });
}

/**
 * Return the active mandate for a loan (if any).
 */
export async function getMandateForLoan(loanId: string) {
  return prisma.nachMandate.findUnique({
    where: { loanId },
    include: {
      presentations: {
        orderBy: { presentedAt: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Find all upcoming instalments (D-2 or earlier) that have an active mandate
 * and no pending/submitted/successful presentation yet.
 * Used by the daily cron.
 */
export async function findInstalmentsForAutoPresent(tenantId?: string) {
  // Per-tenant horizon when scoped; global default (2 days) for the
  // cross-tenant cron sweep.
  const daysBefore = tenantId
    ? (await getNachConfig(tenantId)).presentDaysBefore
    : NACH_DEFAULTS.presentDaysBefore;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + daysBefore);

  const where = {
    status: 'upcoming',
    dueDate: { lte: targetDate },
    loan: {
      status: 'active',
      ...(tenantId ? { tenantId } : {}),
      nachMandate: {
        status: 'active',
      },
    },
    // No active presentation for this instalment yet
    paymentAllocations: { none: {} },
  };

  return prisma.instalment.findMany({
    where,
    include: {
      loan: {
        include: {
          nachMandate: true,
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });
}
