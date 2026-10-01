import type { Prisma } from '@prisma/client';
import prisma from './db';
import { isInterestOnly } from './loanCalculator';
import { ensurePendingPenaltiesForMissedLoans } from './penalties';

type MoneyLike = number | string | { toNumber(): number };

export interface ForeclosureLineItem {
  label: string;
  amount: number;
  /** 'info' = shown for reference, not part of the settlement total. */
  sign: '+' | '-' | '=' | 'info';
  highlight?: boolean;
}

export interface ForeclosureCalculation {
  loanId: string;
  loanCode: string;
  customerName: string;
  customerCode: string;
  customerPhone: string;
  originalPrincipal: number;
  totalCollected: number;
  principalOutstanding: number;
  totalInstalments: number;
  paidInstalments: number;
  missedInstalments: number;
  remainingInstalments: number;
  grossPenalty: number;
  settledPenalty: number;
  waivedPenalty: number;
  netPenaltyDue: number;
  /** DEC-01: pending penalty, resolved separately in the preclose popup (= netPenaltyDue). */
  penaltyDue: number;
  /** Missed days behind the open penalty rows. */
  penaltyMissedDays: number;
  discount: number;
  totalSettlementAmount: number;
  lineItems: ForeclosureLineItem[];
  canForeclose: boolean;
  reason?: string;
  calculatedAt: string;
}

export interface ForeclosureLoanSnapshot {
  id: string;
  loanCode: string;
  status: string;
  principal: MoneyLike;
  totalPayable: MoneyLike;
  totalCollected: MoneyLike;
  totalInstalments: number;
  deductionType?: string | null;
  outstandingPrincipal?: MoneyLike | null;
  customer: {
    name: string;
    customerCode: string;
    phone: string;
  };
  instalments: Array<{
    status: string;
  }>;
  penalties: Array<{
    grossPenalty: MoneyLike;
    settledAmount: MoneyLike;
    waivedAmount: MoneyLike;
    missedDays?: number | null;
  }>;
}

function toNumber(value: MoneyLike): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

function emptyCalculation(
  loan: Pick<ForeclosureLoanSnapshot, 'id'> & Partial<ForeclosureLoanSnapshot>,
  reason: string,
  now: Date,
): ForeclosureCalculation {
  return {
    loanId: loan.id,
    loanCode: loan.loanCode || '',
    customerName: loan.customer?.name || '',
    customerCode: loan.customer?.customerCode || '',
    customerPhone: loan.customer?.phone || '',
    originalPrincipal: 0,
    totalCollected: 0,
    principalOutstanding: 0,
    totalInstalments: 0,
    paidInstalments: 0,
    missedInstalments: 0,
    remainingInstalments: 0,
    grossPenalty: 0,
    settledPenalty: 0,
    waivedPenalty: 0,
    netPenaltyDue: 0,
    penaltyDue: 0,
    penaltyMissedDays: 0,
    discount: 0,
    totalSettlementAmount: 0,
    lineItems: [],
    canForeclose: false,
    reason,
    calculatedAt: now.toISOString(),
  };
}

export function buildForeclosureCalculation(
  loan: ForeclosureLoanSnapshot,
  discount: number = 0,
  now: Date = new Date(),
): ForeclosureCalculation {
  if (loan.status === 'closed') {
    return emptyCalculation(loan, 'This loan is already closed.', now);
  }

  if (loan.status === 'pending') {
    return emptyCalculation(loan, 'Cannot foreclose a loan that has not been disbursed yet.', now);
  }

  if (!['active', 'overdue'].includes(loan.status)) {
    return emptyCalculation(loan, 'Only active or overdue loans can be foreclosed.', now);
  }

  const paidInstalments = loan.instalments.filter((instalment) => instalment.status === 'paid').length;
  const partialInstalments = loan.instalments.filter((instalment) => instalment.status === 'partial').length;
  const missedInstalments = loan.instalments.filter((instalment) => instalment.status === 'missed').length;
  const remainingInstalments = loan.instalments.filter((instalment) => instalment.status === 'upcoming').length;

  const originalPrincipal = toNumber(loan.principal);
  const totalCollected = toNumber(loan.totalCollected);
  const totalPayable = toNumber(loan.totalPayable ?? loan.principal);
  // DEC-01: the payoff of every model except Interest-Only is what is still
  // payable — totalPayable − totalCollected. Interest-Only instalments carry
  // INTEREST only, so its outstanding principal is tracked explicitly and only
  // moves on a part-payment (unchanged branch).
  const principalOutstanding = isInterestOnly(loan.deductionType)
    ? Math.max(0, toNumber(loan.outstandingPrincipal ?? loan.principal))
    : Math.max(0, totalPayable - totalCollected);

  const grossPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.grossPenalty), 0);
  const settledPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.settledAmount), 0);
  const waivedPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.waivedAmount), 0);
  const netPenaltyDue = Math.max(0, grossPenalty - settledPenalty - waivedPenalty);
  const penaltyMissedDays = loan.penalties
    .filter((p) => toNumber(p.grossPenalty) - toNumber(p.settledAmount) - toNumber(p.waivedAmount) > 0)
    .reduce((total, p) => total + Number(p.missedDays ?? 0), 0);

  // Pending penalty is NOT part of the payoff (DEC-01): it is resolved in the
  // preclose penalty popup (paid / discount / waived).
  const maxDiscount = principalOutstanding;
  const safeDiscount = Math.min(Math.max(0, discount || 0), maxDiscount);
  const totalSettlementAmount = Math.max(0, maxDiscount - safeDiscount);

  // Interest-Only reads differently: collections so far were interest, not principal,
  // so showing them as a deduction from the principal would misstate the settlement.
  const lineItems: ForeclosureLineItem[] = isInterestOnly(loan.deductionType)
    ? [
        { label: 'Original principal', amount: originalPrincipal, sign: '+' },
        { label: 'Interest collected so far (does not reduce principal)', amount: totalCollected, sign: '=' },
        { label: 'Principal outstanding', amount: principalOutstanding, sign: '=', highlight: true },
      ]
    : [
        { label: 'Total payable', amount: totalPayable, sign: '+' },
        { label: 'Collected so far', amount: -totalCollected, sign: '-' },
        { label: 'Payoff', amount: principalOutstanding, sign: '=', highlight: true },
      ];
  if (netPenaltyDue > 0) {
    lineItems.push({ label: 'Penalty due (settled separately)', amount: netPenaltyDue, sign: 'info' });
  }

  if (safeDiscount > 0) {
    lineItems.push({ label: 'Settlement discount applied', amount: -safeDiscount, sign: '-' });
  }

  lineItems.push({
    label: 'Total settlement amount',
    amount: totalSettlementAmount,
    sign: '=',
    highlight: true,
  });

  return {
    loanId: loan.id,
    loanCode: loan.loanCode,
    customerName: loan.customer.name,
    customerCode: loan.customer.customerCode,
    customerPhone: loan.customer.phone,
    originalPrincipal,
    totalCollected,
    principalOutstanding,
    totalInstalments: loan.totalInstalments,
    paidInstalments: paidInstalments + partialInstalments,
    missedInstalments,
    remainingInstalments,
    grossPenalty,
    settledPenalty,
    waivedPenalty,
    netPenaltyDue,
    penaltyDue: netPenaltyDue,
    penaltyMissedDays,
    discount: safeDiscount,
    totalSettlementAmount,
    lineItems,
    canForeclose: true,
    calculatedAt: now.toISOString(),
  };
}

/**
 * Loads what `buildForeclosureCalculation` needs. Takes a client so the preclose
 * POST can quote inside its transaction (DEC-01: server-enforced minimum).
 */
export async function loadForeclosureSnapshot(
  db: Prisma.TransactionClient,
  loanId: string,
  tenantId: string,
  access: Record<string, unknown> = {},
) {
  return db.loan.findFirst({
    where: { ...access, id: loanId, tenantId },
    include: {
      customer: {
        select: { name: true, customerCode: true, phone: true },
      },
      instalments: {
        select: { status: true },
        orderBy: { instalmentNo: 'asc' },
      },
      penalties: {
        select: { grossPenalty: true, settledAmount: true, waivedAmount: true, missedDays: true },
      },
    },
  });
}

export async function calculateForeclosure(
  loanId: string,
  tenantId: string,
  discount: number = 0,
  // Caller's visibility scope (`loanAccessWhere`): module + branch / agent linkage.
  access: Record<string, unknown> = {},
): Promise<ForeclosureCalculation> {
  // DEC-01: penaltyDue is read after the missed-day accrual for this loan, the
  // same figure the preclose POST then requires a resolution for.
  await ensurePendingPenaltiesForMissedLoans({ tenantId, loanId });
  const loan = await loadForeclosureSnapshot(prisma, loanId, tenantId, access);

  if (!loan) throw new Error('Loan not found');

  return buildForeclosureCalculation(loan, discount);
}
