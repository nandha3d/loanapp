import type { Prisma } from '@prisma/client';

type SequenceTransaction = Pick<Prisma.TransactionClient, 'contractSequence'>;

export function formatContractCode(prefix: string, sequence: number, padLength = 5): string {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{0,15}$/.test(normalizedPrefix)) {
    throw new Error('Contract prefix is invalid.');
  }
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error('Contract sequence must be a positive whole number.');
  }
  if (!Number.isInteger(padLength) || padLength < 1 || padLength > 12) {
    throw new Error('Contract sequence padding is invalid.');
  }
  return `${normalizedPrefix}${String(sequence).padStart(padLength, '0')}`;
}

/**
 * Increment and read happen in one database statement inside the caller's transaction.
 *
 * The counter is keyed `(tenantId, prefix)` — tenant-wide, no module axis — because
 * `Loan.loanCode` is unique on `(tenantId, loanCode)`. Adding `appType` here gave each
 * module its own `DL` counter while the loans table still demanded one code per tenant,
 * so the second module's insert failed on `loans_tenant_id_loan_code_key`, and because
 * the increment shares the caller's transaction the rollback rewound the counter too —
 * every retry asked for the same taken code forever. Do not re-add a scope axis that the
 * uniqueness it feeds does not have.
 */
export async function nextContractCode(
  tx: SequenceTransaction,
  input: { tenantId: string; prefix: string; padLength?: number },
): Promise<string> {
  const prefix = input.prefix.trim().toUpperCase();
  formatContractCode(prefix, 1, input.padLength);
  const sequence = await tx.contractSequence.upsert({
    where: {
      tenantId_prefix: {
        tenantId: input.tenantId,
        prefix,
      },
    },
    create: {
      tenantId: input.tenantId,
      prefix,
      currentValue: 1,
    },
    update: { currentValue: { increment: 1 } },
    select: { currentValue: true },
  });
  return formatContractCode(prefix, sequence.currentValue, input.padLength);
}
