import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const ISSUER = 'loantrack';
const BORROWER_AUDIENCE = 'borrower-mobile';
const CHALLENGE_AUDIENCE = 'borrower-mobile-otp';

function getSecret(): Uint8Array {
  const raw =
    process.env.MOBILE_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;
  if (!raw) throw new Error('Missing MOBILE_JWT_SECRET / NEXTAUTH_SECRET / AUTH_SECRET');
  return new TextEncoder().encode(raw);
}

export type BorrowerMobileClaims = {
  loanId: string;
  tenantId: string;
  customerId: string;
  role: 'borrower';
};

export type BorrowerChallengeClaims = {
  tenantId: string;
  customerId: string;
  phone: string;
  otpHash: string;
  role: 'borrower_otp';
};

export async function issueBorrowerChallenge(
  claims: BorrowerChallengeClaims,
  ttlSeconds: number,
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(CHALLENGE_AUDIENCE)
    .setSubject(claims.customerId)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifyBorrowerChallenge(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: CHALLENGE_AUDIENCE,
  });
  return payload as BorrowerChallengeClaims;
}

export async function issueBorrowerMobileToken(claims: BorrowerMobileClaims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(BORROWER_AUDIENCE)
    .setSubject(claims.customerId)
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function requireBorrowerMobileContext(req: NextRequest) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const { payload } = await jwtVerify(header.slice('Bearer '.length).trim(), getSecret(), {
      issuer: ISSUER,
      audience: BORROWER_AUDIENCE,
    });
    if (payload.role !== 'borrower') return null;
    return payload as BorrowerMobileClaims;
  } catch {
    return null;
  }
}
