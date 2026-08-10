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

/** Increment and read happen in one database statement inside the caller's transaction. */
export async function nextContractCode(
  tx: SequenceTransaction,
  input: { tenantId: string; appType: string; prefix: string; padLength?: number },
): Promise<string> {
  const prefix = input.prefix.trim().toUpperCase();
  formatContractCode(prefix, 1, input.padLength);
  const sequence = await tx.contractSequence.upsert({
    where: {
      tenantId_appType_prefix: {
        tenantId: input.tenantId,
        appType: input.appType,
        prefix,
      },
    },
    create: {
      tenantId: input.tenantId,
      appType: input.appType,
      prefix,
      currentValue: 1,
    },
    update: { currentValue: { increment: 1 } },
    select: { currentValue: true },
  });
  return formatContractCode(prefix, sequence.currentValue, input.padLength);
}
