import { Prisma } from '@prisma/client';

export interface RecordPaymentLedgerOptions {
  tenantId: string;
  loanId: string;
  instalmentId: string;
  amount: number;
  paymentMode: string;
}

/**
 * Creates a Payment record and a linked PaymentAllocation record inside an
 * existing Prisma transaction.  Call this from any code path that records a
 * loan repayment so every payment is consistently reflected in the ledger.
 */
export async function recordPaymentLedger(
  tx: Prisma.TransactionClient,
  opts: RecordPaymentLedgerOptions,
) {
  const payment = await tx.payment.create({
    data: {
      tenantId: opts.tenantId,
      loanId: opts.loanId,
      amount: opts.amount,
      paymentMode: opts.paymentMode,
      paymentDate: new Date(),
      status: 'completed',
    },
  });

  const allocation = await tx.paymentAllocation.create({
    data: {
      paymentId: payment.id,
      instalmentId: opts.instalmentId,
      amount: opts.amount,
    },
  });

  return { payment, allocation };
}
