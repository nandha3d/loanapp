import { Prisma } from '@prisma/client';
import { bumpAccountBalance } from './balances';
import { POSTING_DEFAULTS, buildDedupKey, type PostingKey } from './postingKeys';

export type OriginationPayoutLeg = { mode: string; amount: number };
export type OriginationPostingLine = {
  key: PostingKey;
  debit: number;
  credit: number;
};

export type OriginationPostingPlan = {
  lines: OriginationPostingLine[];
  totalDebit: number;
  totalCredit: number;
};

export class AccountingConfigurationError extends Error {}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isCashPayoutMode(mode: string): boolean {
  return String(mode).trim().toLowerCase() === 'cash';
}

export function buildOriginationPostingPlan(input: {
  principal: number;
  disbursedAmount: number;
  payoutLegs?: OriginationPayoutLeg[];
  upfrontCreditKey: 'interest_income' | 'processing_fee_income';
}): OriginationPostingPlan {
  const principal = round2(Number(input.principal));
  const disbursedAmount = round2(Number(input.disbursedAmount));
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Principal must be greater than zero.');
  }
  if (!Number.isFinite(disbursedAmount) || disbursedAmount <= 0) {
    throw new Error('Disbursed amount must be greater than zero.');
  }
  if (disbursedAmount > principal) {
    throw new Error('Disbursed amount cannot exceed contractual principal.');
  }

  const legs = input.payoutLegs?.length
    ? input.payoutLegs
    : [{ mode: 'cash', amount: disbursedAmount }];
  const legTotal = round2(legs.reduce((sum, leg) => sum + Number(leg.amount), 0));
  if (legs.some((leg) => !Number.isFinite(Number(leg.amount)) || Number(leg.amount) <= 0)) {
    throw new Error('Payout legs must contain positive amounts.');
  }
  if (Math.abs(legTotal - disbursedAmount) > 0.01) {
    throw new Error(`Payout legs (${legTotal}) do not match disbursed amount (${disbursedAmount}).`);
  }

  const payoutCredits = new Map<PostingKey, number>();
  for (const leg of legs) {
    const key: PostingKey = isCashPayoutMode(leg.mode) ? 'cash_on_hand' : 'bank_account';
    payoutCredits.set(key, round2((payoutCredits.get(key) ?? 0) + Number(leg.amount)));
  }

  const lines: OriginationPostingLine[] = [
    { key: 'loan_receivable', debit: principal, credit: 0 },
    ...Array.from(payoutCredits, ([key, credit]) => ({ key, debit: 0, credit })),
  ];
  const upfrontAmount = round2(principal - disbursedAmount);
  if (upfrontAmount > 0) {
    lines.push({ key: input.upfrontCreditKey, debit: 0, credit: upfrontAmount });
  }

  const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced origination posting: debit ${totalDebit}, credit ${totalCredit}.`);
  }
  return { lines, totalDebit, totalCredit };
}

function parseOverrides(value: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Posts the authoritative disbursement journal inside the caller's transaction.
 * Tenants that have not enabled statutory accounting retain their existing base
 * cash-book behavior until their gated migration is approved.
 */
export async function postLoanOrigination(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId?: string | null;
    loanId: string;
    loanCode: string;
    customerId: string;
    createdById: string;
    entryDate: Date;
    principal: number;
    disbursedAmount: number;
    payoutLegs?: OriginationPayoutLeg[];
    upfrontCreditKey: 'interest_income' | 'processing_fee_income';
  },
): Promise<string | null> {
  const subscription = await tx.tenantSubscription.findUnique({
    where: { tenantId: input.tenantId },
    select: { premiumAccountingEnabled: true },
  });
  if (!subscription?.premiumAccountingEnabled) return null;

  const plan = buildOriginationPostingPlan(input);
  const settings = await tx.accountingSettings.findUnique({
    where: { tenantId: input.tenantId },
    select: { postingOverrides: true },
  });
  const overrides = parseOverrides(settings?.postingOverrides);
  const keys = [...new Set(plan.lines.map((line) => line.key))];
  const codes = new Map(
    keys.map((key) => [
      key,
      typeof overrides[key] === 'string' && overrides[key].trim()
        ? overrides[key].trim()
        : POSTING_DEFAULTS[key],
    ]),
  );
  const accounts = await tx.account.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      code: { in: [...codes.values()] },
    },
    select: { id: true, code: true },
  });
  const accountIds = new Map(accounts.map((account) => [account.code, account.id]));
  for (const [key, code] of codes) {
    if (!accountIds.has(code)) {
      throw new AccountingConfigurationError(`Posting account ${code} (${key}) is not configured.`);
    }
  }

  const narration = `Loan ${input.loanCode} disbursed [AUTO:disburse:${input.loanId}]`;
  const entry = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      entryDate: input.entryDate,
      narration,
      status: 'posted',
      sourceType: 'loan_disburse',
      sourceId: input.loanId,
      voucherType: 'Payment',
      dedupKey: buildDedupKey('loan_disburse', input.tenantId, input.loanId),
      totalDebit: plan.totalDebit,
      totalCredit: plan.totalCredit,
      createdById: input.createdById,
      lines: {
        create: plan.lines.map((line, index) => ({
          accountId: accountIds.get(codes.get(line.key)!)!,
          debit: line.debit,
          credit: line.credit,
          description: narration,
          loanId: input.loanId,
          customerId: input.customerId,
          lineNo: index + 1,
        })),
      },
    },
    select: { id: true },
  });

  for (const line of plan.lines) {
    await bumpAccountBalance(
      tx,
      accountIds.get(codes.get(line.key)!)!,
      input.entryDate,
      line.debit,
      line.credit,
    );
  }
  return entry.id;
}
