import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Bump account balance incrementally when a journal line is posted.
 * Uses MySQL's atomic UPDATE so no read-modify-write race.
 */
export async function bumpAccountBalance(
  tx: TxClient,
  accountId: string,
  entryDate: Date,
  debit: Prisma.Decimal | number,
  credit: Prisma.Decimal | number,
) {
  const periodKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
  const dr = typeof debit === 'number' ? new Prisma.Decimal(debit) : debit;
  const cr = typeof credit === 'number' ? new Prisma.Decimal(credit) : credit;

  // Get account's tenant id
  const account = await tx.account.findUnique({ where: { id: accountId }, select: { tenantId: true } });
  if (!account) return;

  await tx.accountBalance.upsert({
    where: { accountId_periodKey: { accountId, periodKey } },
    create: {
      tenantId: account.tenantId,
      accountId,
      periodKey,
      periodDr: dr,
      periodCr: cr,
      closingDr: dr,
      closingCr: cr,
      updatedAt: new Date(),
    },
    update: {
      periodDr: { increment: dr },
      periodCr: { increment: cr },
      closingDr: { increment: dr },
      closingCr: { increment: cr },
      updatedAt: new Date(),
    },
  });
}

/**
 * Recompute account_balances from scratch for a tenant + period.
 * Called by the nightly cron.
 */
export async function recomputeBalancesForPeriod(
  tx: TxClient,
  tenantId: string,
  periodKey: string,
): Promise<void> {
  // Get period dates
  const [yearStr, monthStr] = periodKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const periodFrom = new Date(year, month, 1);
  const periodTo = new Date(year, month + 1, 0); // last day of month

  // Delete existing balances for this period
  await tx.accountBalance.deleteMany({
    where: {
      tenantId,
      periodKey,
    },
  });

  // Aggregate journal lines
  const lines = await tx.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: {
        tenantId,
        status: 'posted',
        entryDate: { gte: periodFrom, lte: periodTo },
      },
    },
    _sum: { debit: true, credit: true },
  });

  // Get all accounts for this tenant
  const accounts = await tx.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, tenantId: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  for (const line of lines) {
    const account = accountMap.get(line.accountId);
    if (!account) continue;
    const dr = line._sum.debit ?? new Prisma.Decimal(0);
    const cr = line._sum.credit ?? new Prisma.Decimal(0);

    await tx.accountBalance.create({
      data: {
        tenantId,
        accountId: line.accountId,
        periodKey,
        periodDr: dr,
        periodCr: cr,
        closingDr: dr,
        closingCr: cr,
        updatedAt: new Date(),
      },
    });
  }
}
