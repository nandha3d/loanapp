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
 *
 * A record belongs to exactly one branch: its own `branchId`. This is the ONLY
 * branch scope for customers and loans — see `lib/branchScope.ts` for why the
 * "reach" variant that also matched unbranched records and the filer's branch
 * was removed.
 */
export function scopedBranchWhere(claims: MobileTokenClaims) {
  // NO role exemption. `claims.branchId` is already the ACTIVE branch, resolved
  // by resolveScopeBranchId: null for "All Branches", the selected branch for a
  // superadmin using the switcher, the caller's own branch for everyone else.
  //
  // This used to early-return {} for superadmin/developer, which threw that
  // resolved answer away and ran every read tenant-wide. The branch switcher
  // then did nothing for the role that exists to use it: selecting Erode showed
  // Head Office's customers, loans, agents and wallet. 63 v1 routes share this
  // helper, and the web dashboard reaches them through serverFetch, so the leak
  // was identical on web and mobile.
  //
  // "Sees all branches" is expressed by SELECTING All Branches, which makes
  // branchId null and yields {} here — not by ignoring the selection.
  return claims.branchId ? { branchId: claims.branchId } : {};
}

export type MobileApiContext = MobileTokenClaims & {
  tenantSlug: string | null;
  /**
   * Branch the caller's own user record sits on, straight from the token.
   * `branchId` above is the ACTIVE branch, which differs for a superadmin
   * working another branch through the branch switcher. Reads use `branchId`;
   * writes use `resolveWriteBranchId`. Nothing should use this directly.
   */
  homeBranchId: string | null;
  requestedBranchId: string | null;
};

/**
 * Resolves the branch a v1 request acts on.
 *
 * Only a superadmin/developer may steer it, via `X-Branch-Id` — the branch
 * switcher in the web dashboard, forwarded by `lib/api-client/server.ts`. The
 * value is validated against the caller's tenant, so a forged header can never
 * reach another tenant's branch. Everyone else is pinned to the branch in their
 * token; their header is ignored outright.
 *
 * Before this, the web sent the caller's HOME branch. A superadmin sits on one
 * branch and works all of them, so every record they created was stamped with
 * their own branch no matter which branch they had selected — the other
 * branch's records then surfaced in that one branch admin's lists.
 *
 * `null` means tenant-wide ("All Branches").
 */
async function resolveScopeBranchId(
  claims: MobileTokenClaims,
  requestedBranchId: string | null,
): Promise<string | null> {
  const privileged = claims.role === 'superadmin' || claims.role === 'developer';
  if (!privileged) return claims.branchId;
  if (!requestedBranchId || requestedBranchId === 'all') return null;
  if (requestedBranchId === claims.branchId) return claims.branchId;

  try {
    const prisma = (await import('../db')).default;
    const branch = await prisma.branch.findFirst({
      where: { id: requestedBranchId, tenantId: claims.tenantId },
      select: { id: true },
    });
    return branch?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The branch a newly created record must be stamped with.
 *
 * Order matters. A record belongs where its SUBJECT sits, not where its author
 * sits: a loan for an Erode customer is an Erode loan even when a superadmin
 * whose own user record sits on Head Office raises it. Getting this backwards
 * is what put one branch's loans into another branch admin's list — and,
 * because `scopedBranchWhere` matches the record's own branch, hid them from
 * the admin who actually owns them.
 *
 * Falls back to the caller's active branch, then their home branch, then — when
 * the tenant has exactly one branch — that branch, so records are never
 * branchless. An unbranched record is visible to superadmins only.
 */
export async function resolveWriteBranchId(
  ctx: MobileApiContext,
  subjectBranchId?: string | null,
): Promise<string | null> {
  if (subjectBranchId) return subjectBranchId;
  if (ctx.branchId) return ctx.branchId;
  if (ctx.homeBranchId) return ctx.homeBranchId;

  try {
    const prisma = (await import('../db')).default;
    const branches = await prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, status: 'active' },
      select: { id: true },
      take: 2,
    });
    return branches.length === 1 ? branches[0]!.id : null;
  } catch {
    return null;
  }
}

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
    const requestedBranchId = req.headers.get('x-branch-id');
    const branchId = await resolveScopeBranchId(claims, requestedBranchId);
    return {
      context: {
        ...claims,
        appType,
        branchId,
        homeBranchId: claims.branchId,
        tenantSlug: req.headers.get('x-tenant-slug'),
        requestedBranchId,
      },
    };
  } catch {
    return { response: fail('Unauthorized', 401) };
  }
}
