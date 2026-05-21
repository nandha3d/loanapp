import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { fail } from './v1-envelope';

const ALG = 'HS256';
const ISSUER = 'loantrack';
const AUDIENCE = 'mobile';

function getSecret(): Uint8Array {
  const raw = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error('Missing MOBILE_JWT_SECRET / NEXTAUTH_SECRET');
  return new TextEncoder().encode(raw);
}

export type MobileTokenClaims = {
  userId: string;
  tenantId: string;
  branchId: string | null;
  role: string;
  appType: string;
};

const ACCESS_TOKEN_TTL = '30d'; // matches web NextAuth maxAge

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
