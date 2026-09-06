/**
 * Shared harness for the Auto Finance suite.
 *
 * The transport-level helpers are identical across module suites and are
 * re-exported from the micro-lending suite rather than copied — one client, one
 * branch-header convention, one guard on the database name.
 */
export { loadE2eEnv, assertSafeTestDatabase, BASE_URL } from '../../microlending/support/env';
export { api, loginApi, registerTenant, setTenantSetting } from '../../microlending/support/api';
export type { ApiEnvelope, Session } from '../../microlending/support/api';
export { db, closeDb, num, waitForRow } from '../../microlending/support/db';
export { makeRunId, runPhone } from '../../microlending/support/state';

import { db, num } from '../../microlending/support/db';

/** Branch cash pool for the autofinance module — the MONEY-16/17 assertions. */
export async function branchPool(tenantId: string, branchId: string): Promise<number> {
  const account = await db().branchCashAccount.findFirst({
    where: { tenantId, appType: 'autofinance', branchId },
  });
  return num(account?.balance);
}

/** An agent's field float. */
export async function agentFloat(tenantId: string, agentId: string): Promise<number> {
  const account = await db().agentAccount.findFirst({
    where: { tenantId, appType: 'autofinance', agentId },
  });
  return num(account?.balance);
}

/** Deterministic idempotency key so a replay assertion is reproducible. */
export function idemKey(runId: string, label: string): string {
  return `auto-${runId}-${label}`;
}

/** A registration plate unique to this run, so a re-run never trips AF-4. */
export function plate(runId: string, seq: number): string {
  const suffix = String(seq).padStart(4, '0');
  return `TN39${runId.slice(0, 2).toUpperCase()}${suffix}`;
}
