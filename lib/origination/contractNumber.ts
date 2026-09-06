import type { Prisma } from '@prisma/client';

type SequenceTransaction = Pick<Prisma.TransactionClient, 'contractSequence' | 'loan'>;

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

/** How many taken codes to step over before giving up and reporting the drift. */
const MAX_CATCH_UP_STEPS = 1000;

/**
 * Issue the next contract code for a tenant, inside the caller's transaction.
 *
 * Keyed `(tenantId, prefix)` — tenant-wide, no module axis — because
 * `Loan.loanCode` is unique on `(tenantId, loanCode)` (rule ORIG-1). `appType` is
 * accepted only to stamp a newly created counter for reference; it is never part
 * of the lookup.
 *
 * WHY THE COLLISION GUARD EXISTS (rule ORIG-2)
 * The increment shares the caller's transaction, so a failed loan insert rolls
 * the counter back with it. That makes a code collision PERMANENT rather than
 * transient: every retry re-requests the same taken code and origination is
 * wedged until someone repairs the counter by hand. It has already happened once
 * in production, when this table shipped with `current_value` defaulting to 0
 * while loans issued by the previous generator already occupied those codes.
 *
 * So the counter is treated as a hint, never as truth. If the code it produces is
 * already taken, we step forward until we find a free one and leave the counter
 * parked there. That makes the sequence self-healing for every way it can fall
 * behind the data — a restored backup, an imported book of loans, a hand-inserted
 * row, a counter created after the loans it should have been counting.
 *
 * Cost in the normal case is one indexed lookup on the `(tenantId, loanCode)`
 * unique index. The catch-up loop only runs when the counter is actually behind.
 */
export async function nextContractCode(
  tx: SequenceTransaction,
  input: { tenantId: string; appType?: string | null; prefix: string; padLength?: number },
): Promise<string> {
  const prefix = input.prefix.trim().toUpperCase();
  formatContractCode(prefix, 1, input.padLength);

  const sequence = await tx.contractSequence.upsert({
    where: { tenantId_prefix: { tenantId: input.tenantId, prefix } },
    create: {
      tenantId: input.tenantId,
      // Stamped for reference only — never read back as scope. See the model doc.
      appType: input.appType ?? null,
      prefix,
      currentValue: 1,
    },
    update: { currentValue: { increment: 1 } },
    select: { currentValue: true },
  });

  let value = sequence.currentValue;
  let code = formatContractCode(prefix, value, input.padLength);

  // Fast path: the counter is ahead of the data, as it should be.
  const collision = await tx.loan.findFirst({
    where: { tenantId: input.tenantId, loanCode: code },
    select: { id: true },
  });
  if (!collision) return code;

  // Slow path: the counter is behind. Walk forward to the first free code and
  // park the counter there, so the next origination starts from the truth.
  for (let step = 0; step < MAX_CATCH_UP_STEPS; step++) {
    value += 1;
    code = formatContractCode(prefix, value, input.padLength);
    const taken = await tx.loan.findFirst({
      where: { tenantId: input.tenantId, loanCode: code },
      select: { id: true },
    });
    if (!taken) {
      await tx.contractSequence.update({
        where: { tenantId_prefix: { tenantId: input.tenantId, prefix } },
        data: { currentValue: value },
      });
      return code;
    }
  }

  // Past this point the drift is too large to be an accident. Fail loudly with a
  // message that says what to repair, rather than looping over a whole book.
  throw new Error(
    `Contract sequence for "${prefix}" is more than ${MAX_CATCH_UP_STEPS} codes behind the loans already issued. ` +
      'Reseed it with scripts/fix-contract-sequences.sql before creating more loans.',
  );
}
