import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ChitInvitePayload {
  tenantId: string;
  groupId: string;
  groupCode: string;
  exp: number;
}

function resolveInviteSecret(secretOverride?: string): string {
  const s =
    secretOverride ??
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== 'production' ? 'dev-chit-invite-secret-32-chars-minimum' : '');
  if (!s || s.length < 16) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required to sign chit invite links.');
  }
  return s;
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

export function createChitInviteToken(
  input: {
    tenantId: string;
    groupId: string;
    groupCode: string;
    ttlDays?: number;
  },
  secretOverride?: string,
): string {
  const ttlMs = Math.max(1, input.ttlDays ?? 30) * 24 * 60 * 60 * 1000;
  const payload: ChitInvitePayload = {
    tenantId: input.tenantId,
    groupId: input.groupId,
    groupCode: input.groupCode,
    exp: Date.now() + ttlMs,
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', resolveInviteSecret(secretOverride))
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyChitInviteToken(
  token: string | null | undefined,
  expectedGroupCodeOrId?: string,
  secretOverride?: string,
): ChitInvitePayload | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!encoded || !sig) return null;

  try {
    const expectedSig = createHmac('sha256', resolveInviteSecret(secretOverride))
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(b64urlDecode(encoded).toString('utf8')) as ChitInvitePayload;
    if (!payload.tenantId || !payload.groupId || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    if (
      expectedGroupCodeOrId &&
      expectedGroupCodeOrId !== payload.groupCode &&
      expectedGroupCodeOrId !== payload.groupId
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildChitJoinUrl(params: {
  origin: string;
  groupCode: string;
  token: string;
}): string {
  const cleanOrigin = params.origin.replace(/\/+$/, '');
  return `${cleanOrigin}/join/${encodeURIComponent(params.groupCode)}?invite=${encodeURIComponent(params.token)}`;
}

export function buildWhatsAppShareUrl(params: {
  groupName: string;
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  joinUrl: string;
  currencySymbol?: string;
}): string {
  const sym = params.currencySymbol || '₹';
  const text = [
    `Join *${params.groupName}* on ZoloFund!`,
    `Chit Value: ${sym}${params.chitValue.toLocaleString('en-IN')} | Installment: ${sym}${params.monthlyContrib.toLocaleString('en-IN')} | ${params.totalMembers} Members`,
    `Live Auction, Group Chat & PDF Statements:`,
    params.joinUrl,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
