import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { fail } from './v1-envelope';

const ALG = 'HS256';
const ISSUER = 'loantrack';
const AUDIENCE = 'mobile';

function getSecret(): Uint8Array {
  // Prefer a dedicated mobile secret (best practice: don't share the web
  // session secret), but fall back to the session secret under either name so
  // a deployment that sets only AUTH_SECRET (deploy/README.md) or only
  // NEXTAUTH_SECRET (shipped .env) still issues/verifies mobile tokens.
  const raw =
    process.env.MOBILE_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;
  if (!raw) throw new Error('Missing MOBILE_JWT_SECRET / NEXTAUTH_SECRET / AUTH_SECRET');
  return new TextEncoder().encode(raw);
}

export type MobileTokenClaims = {
  userId: string;
  tenantId: string;
  branchId: string | null;
  role: string;
  appType: string;
};

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function issueMobileToken(claims: MobileTokenClaims): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.userId)
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

export async function issueRefreshToken(userId: string, tenantId: string): Promise<string> {
  const { randomBytes } = await import('crypto');
  const token = randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const prisma = (await import('../db')).default;
  await prisma.mobileRefreshToken.create({ data: { token, userId, tenantId, expiresAt } });
  return token;
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ claims: MobileTokenClaims; newRefreshToken: string } | null> {
  const prisma = (await import('../db')).default;
  let record: any = null;
  try {
    record = await prisma.mobileRefreshToken.findUnique({ where: { token: oldToken } });
  } catch {
    return null; // table doesn't exist yet — migration pending
  }
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  // Revoke old token
  await prisma.mobileRefreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, tenantId: true, branchId: true, role: true, appType: true, status: true },
  });
  if (!user || user.status !== 'active') return null;

  const claims: MobileTokenClaims = {
    userId: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    appType: user.appType,
  };
  const newRefreshToken = await issueRefreshToken(user.id, user.tenantId);
  return { claims, newRefreshToken };
}

export async function verifyMobileToken(token: string): Promise<MobileTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return {
    userId: payload.userId as string,
    tenantId: payload.tenantId as string,
    branchId: (payload.branchId as string | null) ?? null,
    role: payload.role as string,
    appType: (payload.appType as string) || 'microlending',
  };
}

/**
 * Branch-scoped where clause helper — mirrors `lib/apiAuth.ts#scopedBranchWhere`
 * so v1 handlers can reuse the same scoping behaviour.
 */
export function scopedBranchWhere(claims: MobileTokenClaims) {
  if (claims.role === 'superadmin' || claims.role === 'developer') {
    return {};
  }
  return claims.branchId ? { branchId: claims.branchId } : {};
}

export type MobileApiContext = MobileTokenClaims & {
  tenantSlug: string | null;
  requestedBranchId: string | null;
};

export type MobileAuthResult =
  | { context: MobileApiContext; response?: never }
  | { context?: never; response: Response };

/**
 * Validates `Authorization: Bearer <jwt>` and reads `X-Tenant-Slug` /
 * `X-Branch-Id` headers per spec §2.4.
 */
export async function requireMobileContext(req: NextRequest): Promise<MobileAuthResult> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return { response: fail('Unauthorized', 401) };
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = await verifyMobileToken(token);
    return {
      context: {
        ...claims,
        tenantSlug: req.headers.get('x-tenant-slug'),
        requestedBranchId: req.headers.get('x-branch-id'),
      },
    };
  } catch {
    return { response: fail('Unauthorized', 401) };
  }
}
