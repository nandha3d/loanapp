/**
 * Shared harness for the Secured Lending suite.
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

/** Branch cash pool for the property module — the MONEY-16/17 assertions. */
export async function branchPool(
  tenantId: string,
  branchId: string,
  appType: 'property' | 'productfinance' = 'property',
): Promise<number> {
  const account = await db().branchCashAccount.findFirst({ where: { tenantId, appType, branchId } });
  return num(account?.balance);
}

/** An agent's field float. */
export async function agentFloat(
  tenantId: string,
  agentId: string,
  appType: 'property' | 'productfinance' = 'property',
): Promise<number> {
  const account = await db().agentAccount.findFirst({ where: { tenantId, appType, agentId } });
  return num(account?.balance);
}

/** Deterministic idempotency key so a replay assertion is reproducible. */
export function idemKey(runId: string, label: string): string {
  return `ppf-${runId}-${label}`;
}

/** A survey number unique to this run. */
export function surveyNo(runId: string, seq: number): string {
  const suffix = String(seq).padStart(4, '0');
  return `SUR-${runId.slice(0, 3).toUpperCase()}-${suffix}`;
}
