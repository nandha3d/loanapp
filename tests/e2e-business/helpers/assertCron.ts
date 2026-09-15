import assert from 'node:assert/strict';
import { routeRequest, type ApiResponse } from './apiClient';
import { getPrisma } from './testDb';

export const TEST_CRON_SECRET = 'phase5-cron-secret';

export function ensureCronSecret() {
  process.env.CRON_SECRET = TEST_CRON_SECRET;
  process.env.CRON_IP_ALLOWLIST = '';
}

export async function cronGet<T = unknown>(input: {
  importPath: string;
  path: string;
  secret?: string;
}): Promise<ApiResponse<T>> {
  ensureCronSecret();
  return routeRequest<T>({
    importPath: input.importPath,
    method: 'GET',
    path: input.path,
    headers: { authorization: `Bearer ${input.secret ?? TEST_CRON_SECRET}` },
  });
}

export async function assertCronUnauthorized(input: { importPath: string; path: string }) {
  const response = await cronGet({ ...input, secret: 'wrong-secret' });
  assert.equal([401, 403].includes(response.status), true, `cron should reject wrong secret: ${response.text}`);
}

export async function expireCronLocks(ids: string[]) {
  const expired = new Date(Date.now() - 60_000);
  await getPrisma().cronLock.updateMany({
    where: { id: { in: ids } },
    data: { expiresAt: expired, lockedAt: expired },
  });
}

export async function countRows(table: string, whereSql: string, ...params: unknown[]) {
  const rows = await getPrisma().$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE ${whereSql}`,
    ...params,
  );
  return Number(rows[0]?.count ?? 0);
}

export function assertNoDuplicateCount(afterFirst: number, afterSecond: number, label: string) {
  assert.equal(afterSecond, afterFirst, label);
}
