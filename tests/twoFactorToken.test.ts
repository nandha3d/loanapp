import assert from 'node:assert/strict';
import { openSetup, sealSetup } from '../lib/twoFactorToken';

process.env.MOBILE_JWT_SECRET = 'test-secret-for-two-factor-token';
const claims = { tenantId: 'tenant-a', userId: 'user-a', version: '2026-09-26T00:00:00.000Z', secret: 'TOPSECRET' };
async function main() {
  const token = await sealSetup(claims);
  assert.equal(await openSetup(token, claims), claims.secret);
  await assert.rejects(openSetup(token, { ...claims, tenantId: 'tenant-b' }));
  await assert.rejects(openSetup(`${token}x`, claims));
  console.log('2FA setup token binding passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
