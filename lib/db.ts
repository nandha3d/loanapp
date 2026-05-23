import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaInstance = globalForPrisma.prisma ?? new PrismaClient();

// ─── Immutability Guard for RBI Audit Records ────────────────────────────────
// NpaHistory records must NEVER be modified or deleted.
// LoanProvisioning records must NEVER be deleted (updates allowed for same-day snapshots via cron upsert).
prismaInstance.$use(async (params, next) => {
  if (
    params.model === 'NpaHistory' &&
    ['delete', 'deleteMany', 'update', 'updateMany'].includes(params.action)
  ) {
    throw new Error('IMMUTABLE_RECORD: NPA history records cannot be modified or deleted.');
  }

  if (
    params.model === 'LoanProvisioning' &&
    ['delete', 'deleteMany'].includes(params.action)
  ) {
    throw new Error('IMMUTABLE_RECORD: Loan provisioning snapshots cannot be deleted.');
  }

  return next(params);
});

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance;

export default prisma;
