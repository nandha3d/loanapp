/**
 * Shared harness for the chit suite.
 *
 * The transport-level helpers (env loading, the JWT API client, the QA Prisma
 * client, run-id generation) are identical to the micro-lending suite and are
 * re-exported here rather than copied. One client, one branch-header
 * convention, one safety guard on the database name — a second copy would drift
 * and the drift would be invisible until a branch-isolation assertion quietly
 * stopped sending X-Branch-Id.
 */
export { loadE2eEnv, assertSafeTestDatabase, BASE_URL } from '../../microlending/support/env';
export { api, loginApi, registerTenant, setTenantSetting } from '../../microlending/support/api';
export type { ApiEnvelope, Session } from '../../microlending/support/api';
export { db, closeDb, num, waitForRow } from '../../microlending/support/db';
export { makeRunId, runPhone } from '../../microlending/support/state';

import { db, num } from '../../microlending/support/db';

/** Branch cash pool balance — the figure MONEY-16/17 assertions hang off. */
export async function branchPool(tenantId: string, branchId: string): Promise<number> {
  const account = await db().branchCashAccount.findFirst({
    where: { tenantId, appType: 'chitfunds', branchId },
  });
  return num(account?.balance);
}

/** Every receipt of a type for a group, newest first. */
export async function chitReceipts(tenantId: string, receiptType: string) {
  return db().chitReceipt.findMany({
    where: { tenantId, receiptType },
    orderBy: { issuedAt: 'desc' },
  });
}

/** The account entries a chit action is supposed to have posted. */
export async function chitEntries(tenantId: string, type: string, referenceId?: string) {
  return db().accountEntry.findMany({
    where: { tenantId, type, ...(referenceId ? { referenceId } : {}) },
    orderBy: { entryDate: 'desc' },
  });
}

/**
 * Wait for a room to reach a status.
 *
 * Rooms close lazily on the first request after expiry, so a test cannot simply
 * sleep and read the row — something has to poll the endpoint to trigger the
 * close. This helper does the poll that the real client would do.
 */
export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  what: string,
  timeoutMs = 60_000,
  intervalMs = 2_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}; last value ${JSON.stringify(last)}`);
}

/** Deterministic idempotency key so a replay assertion is reproducible. */
export function idemKey(runId: string, label: string): string {
  return `cf-${runId}-${label}`;
}
