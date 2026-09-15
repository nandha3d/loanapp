import prisma from './db';
import { isInterestOnly } from './loanCalculator';

type MoneyLike = number | string | { toNumber(): number };

export interface ForeclosureLineItem {
  label: string;
  amount: number;
  sign: '+' | '-' | '=';
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
  // For every model except Interest-Only the instalments repay the principal, so
  // what's left is principal minus what's been collected. Interest-Only instalments
  // carry INTEREST only — netting them off principal would show a fully-serviced
  // borrower as owing nothing — so its outstanding principal is tracked explicitly
  // and only moves on a part-payment.
  const principalOutstanding = isInterestOnly(loan.deductionType)
    ? Math.max(0, toNumber(loan.outstandingPrincipal ?? loan.principal))
    : Math.max(0, originalPrincipal - totalCollected);

  const grossPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.grossPenalty), 0);
  const settledPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.settledAmount), 0);
  const waivedPenalty = loan.penalties.reduce((total, penalty) => total + toNumber(penalty.waivedAmount), 0);
  const netPenaltyDue = Math.max(0, grossPenalty - settledPenalty - waivedPenalty);

  const maxDiscount = principalOutstanding + netPenaltyDue;
  const safeDiscount = Math.min(Math.max(0, discount || 0), maxDiscount);
  const totalSettlementAmount = Math.max(0, maxDiscount - safeDiscount);

  // Interest-Only reads differently: collections so far were interest, not principal,
  // so showing them as a deduction from the principal would misstate the settlement.
  const lineItems: ForeclosureLineItem[] = isInterestOnly(loan.deductionType)
    ? [
        { label: 'Original principal', amount: originalPrincipal, sign: '+' },
        { label: 'Interest collected so far (does not reduce principal)', amount: totalCollected, sign: '=' },
        { label: 'Principal outstanding', amount: principalOutstanding, sign: '=', highlight: true },
        { label: `Net accrued penalty (${missedInstalments} missed instalments)`, amount: netPenaltyDue, sign: '+' },
      ]
    : [
        { label: 'Original principal', amount: originalPrincipal, sign: '+' },
        { label: 'Total collected so far', amount: -totalCollected, sign: '-' },
        { label: 'Principal outstanding', amount: principalOutstanding, sign: '=', highlight: true },
        { label: `Net accrued penalty (${missedInstalments} missed instalments)`, amount: netPenaltyDue, sign: '+' },
      ];

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
    discount: safeDiscount,
    totalSettlementAmount,
    lineItems,
    canForeclose: true,
    calculatedAt: now.toISOString(),
  };
}

export async function calculateForeclosure(
  loanId: string,
  tenantId: string,
  discount: number = 0,
): Promise<ForeclosureCalculation> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    include: {
      customer: {
        select: { name: true, customerCode: true, phone: true },
      },
      instalments: {
        select: { status: true },
        orderBy: { instalmentNo: 'asc' },
      },
      penalties: {
        select: { grossPenalty: true, settledAmount: true, waivedAmount: true },
      },
    },
  });

  if (!loan) throw new Error('Loan not found');

  return buildForeclosureCalculation(loan, discount);
}
