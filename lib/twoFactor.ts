import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import prisma from '@/lib/db';
import { getSetting } from '@/lib/tenant';
import { checkRateLimit } from '@/lib/rateLimit';
import { sealSetup, openSetup } from '@/lib/twoFactorToken';

export type TwoFactorActor = { tenantId: string; userId: string; role: string };

export class TwoFactorError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function requireManager(actor: TwoFactorActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) throw new TwoFactorError('Forbidden', 403);
}

async function userFor(actor: TwoFactorActor) {
  requireManager(actor);
  const user = await prisma.user.findFirst({
    where: { id: actor.userId, tenantId: actor.tenantId, status: 'active' },
    select: { id: true, username: true, totpSecret: true, updatedAt: true, role: true },
  });
  if (!user || !['admin', 'superadmin', 'developer'].includes(user.role)) {
    throw new TwoFactorError('Forbidden', 403);
  }
  return user;
}

export async function twoFactorStatus(actor: TwoFactorActor) {
  const user = await userFor(actor);
  return { enabled: Boolean(user.totpSecret) };
}

export async function startTwoFactorSetup(actor: TwoFactorActor) {
  const user = await userFor(actor);
  if (user.totpSecret) throw new TwoFactorError('2FA is already enabled', 409);
  const secret = generateSecret();
  const issuer = await getSetting(actor.tenantId, 'app_name', 'ZoloFund');
  const uri = generateURI({ secret, label: user.username, issuer });
  const setupToken = await sealSetup({
    tenantId: actor.tenantId,
    userId: user.id,
    version: user.updatedAt.toISOString(),
    secret,
  });
  return { secret, qrCodeUrl: await QRCode.toDataURL(uri), setupToken };
}

export async function verifyTwoFactorSetup(actor: TwoFactorActor, setupToken: string, code: string) {
  const user = await userFor(actor);
  if (user.totpSecret) throw new TwoFactorError('2FA is already enabled', 409);
  const rate = await checkRateLimit(`2fa:setup:${actor.tenantId}:${actor.userId}`, {
    limit: 5, windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) throw new TwoFactorError('Too many attempts. Try again later.', 429);
  if (!/^\d{6}$/.test(code)) throw new TwoFactorError('Invalid verification code', 400);
  let secret: string;
  try {
    secret = await openSetup(setupToken, {
      tenantId: actor.tenantId, userId: user.id, version: user.updatedAt.toISOString(),
    });
  } catch {
    throw new TwoFactorError('Setup expired. Start again.', 400);
  }
  const { valid } = verifySync({ token: code, secret });
  if (!valid) throw new TwoFactorError('Invalid verification code', 400);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: user.id, tenantId: actor.tenantId, totpSecret: null, updatedAt: user.updatedAt },
      data: { totpSecret: secret },
    });
    if (changed.count !== 1) throw new TwoFactorError('Setup expired. Start again.', 409);
    await tx.auditLog.create({
      data: { tenantId: actor.tenantId, userId: user.id, action: 'enable', entityType: 'two_factor', entityId: user.id },
    });
    return { enabled: true };
  });
}

export async function disableTwoFactor(actor: TwoFactorActor) {
  const user = await userFor(actor);
  if (!user.totpSecret) return { enabled: false };
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { totpSecret: null } });
    await tx.auditLog.create({
      data: { tenantId: actor.tenantId, userId: user.id, action: 'disable', entityType: 'two_factor', entityId: user.id },
    });
    return { enabled: false };
  });
}
