import { PrismaClient } from '@prisma/client';
import { MONEY_SCOPED_MODELS } from './scope';

// For shared/low-resource hosting, tune the connection pool via DATABASE_URL:
//   ?connection_limit=5&pool_timeout=10
// Example: mysql://user:pass@host:3306/db?connection_limit=5&pool_timeout=10
// Default Prisma connection_limit is num_cpus * 2 + 1 (often too high on shared VPS).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaInstance =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
      : [{ level: 'warn', emit: 'stdout' }],
  });

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

// ─── Dev-only appType scope tripwire ─────────────────────────────────────────
// Warns (never throws) when a list/aggregate on a money-bearing module-scoped
// model omits `appType` in its where — the recurring cross-module leak bug.
// Tenant-wide background sweeps (crons) legitimately trip this; the warning is a
// hint to confirm intent, not an error. Skipped entirely in production.
if (process.env.NODE_ENV !== 'production') {
  prismaInstance.$use(async (params, next) => {
    if (
      params.model &&
      MONEY_SCOPED_MODELS.has(params.model) &&
      ['findMany', 'aggregate', 'groupBy', 'count'].includes(params.action)
    ) {
      const where = (params.args?.where ?? {}) as Record<string, unknown>;
      const hasAppType =
        'appType' in where ||
        // relation-scoped (e.g. instalment via loan) — caller filtered upstream
        Object.values(where).some(
          (v) => v && typeof v === 'object' && 'appType' in (v as Record<string, unknown>),
        );
      if (!hasAppType) {
        console.warn(
          `[scope] ${params.model}.${params.action} has no appType filter — ` +
            `module data may leak across apps. Add appType to the where-clause unless ` +
            `this is an intentional tenant-wide read (say so in a comment if it is).`,
        );
      }
    }
    return next(params);
  });
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance;

export default prisma;
