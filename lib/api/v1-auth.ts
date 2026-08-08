import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { fail } from './v1-envelope';
import { checkLoginWindow } from '../autofinance/operations';

const ALG = 'HS256';
const ISSUER = 'zolofund';
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

/**
 * Enforces the Auto Finance allowed-login-window on the mobile field app.
 *
 * Applied when a token is minted (login, 2FA, Google, refresh) rather than on
 * every request, so the guard costs nothing on the hot path. Access tokens
 * live 1h and refresh is re-checked, which bounds how far past the window an
 * already-signed-in agent can keep working.
 *
 * Returns a 403 response when the window is closed, or null to continue.
 */
export function loginWindowFailure(
  user: { role: string; allowedLoginStart?: string | null; allowedLoginEnd?: string | null },
  now: Date = new Date(),
) {
  // Owners are exempt — see lib/auth.ts for the same carve-out.
  if (user.role === 'superadmin' || user.role === 'developer') return null;
  const result = checkLoginWindow(user, now);
  return result.allowed ? null : fail(result.message ?? 'Login is not allowed at this time.', 403);
}

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

/**
 * Branch scope for records that carry a `branchId` AND were filed by a staff
 * member — customers (`agent`) and loans (`createdBy`).
 *
 * A record does NOT always sit on its filer's branch: a customer inherits the
 * branch of its ROUTE, so an agent on branch A working a route in branch B
 * files records onto B. Matching the record's branch alone therefore hid those
 * records from the very admin who manages the agent that created them, while
 * superadmins — who are never branch-filtered — saw everything. That is the
 * same defect already worked around for agents in the customers/loans list
 * handlers, never applied to admins.
 *
 * Reaches: the admin's own branch, unbranched records (reviewable by anyone in
 * the tenant), and records filed by staff sitting on the admin's branch.
 */
export function scopedBranchReachWhere(claims: MobileTokenClaims, filerRelation: string) {
  if (claims.role === 'superadmin' || claims.role === 'developer') {
    return {};
  }
  if (!claims.branchId) return {};
  return {
    OR: [
      { branchId: claims.branchId },
      { branchId: null },
      { [filerRelation]: { branchId: claims.branchId } },
    ],
  };
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
    // Active module override: web forwards the URL-resolved module via X-App-Type
    // (already module-gated by getUserAppType). Mobile sends no header → JWT appType.
    // Privileged roles may switch module freely; others are pinned to their own.
    const requestedAppType = req.headers.get('x-app-type');
    const privileged = ['superadmin', 'developer', 'admin'].includes(claims.role);
    const appType =
      requestedAppType && (privileged || requestedAppType === claims.appType)
        ? requestedAppType
        : claims.appType;
    return {
      context: {
        ...claims,
        appType,
        tenantSlug: req.headers.get('x-tenant-slug'),
        requestedBranchId: req.headers.get('x-branch-id'),
      },
    };
  } catch {
    return { response: fail('Unauthorized', 401) };
  }
}
