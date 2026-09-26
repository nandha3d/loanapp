import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';

export type SetupClaims = {
  tenantId: string;
  userId: string;
  version: string;
  secret: string;
};

function key(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('Missing authentication secret');
  return createHash('sha256').update('totp-setup:').update(secret).digest();
}

export async function sealSetup(claims: SetupClaims): Promise<string> {
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .encrypt(key());
}

export async function openSetup(token: string, expected: Omit<SetupClaims, 'secret'>): Promise<string> {
  const { payload } = await jwtDecrypt(token, key());
  if (payload.tenantId !== expected.tenantId || payload.userId !== expected.userId ||
      payload.version !== expected.version || typeof payload.secret !== 'string') {
    throw new Error('Setup token does not match user');
  }
  return payload.secret;
}
