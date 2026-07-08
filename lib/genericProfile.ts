import { createHmac } from 'crypto';
import { hash } from 'bcryptjs';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/notify/channels/email';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Self-service profile (name/phone edit + OTP password change) for
 * non-superadmin roles (admin, agent, developer). Deliberately separate from
 * lib/profile.ts (superadmin-only: tenant/subscription/invoices) so that file
 * stays untouched — this is a parallel, smaller account view.
 */

const OTP_WINDOW_MS = 10 * 60 * 1000;

type AccountContext = {
  userId: string;
  tenantId: string;
  ip?: string;
  userAgent?: string | null;
};

function otpBucket(now = Date.now()) {
  return Math.floor(now / OTP_WINDOW_MS);
}

function generateAccountOtp(userId: string, email: string, bucket: number): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret';
  const raw = createHmac('sha256', secret)
    .update(`account-password:${userId}:${email.toLowerCase()}:${bucket}`)
    .digest('hex');
  return String(parseInt(raw.substring(0, 8), 16) % 1_000_000).padStart(6, '0');
}

function isValidAccountOtp(userId: string, email: string, otp: string): boolean {
  const bucket = otpBucket();
  return (
    otp === generateAccountOtp(userId, email, bucket) ||
    otp === generateAccountOtp(userId, email, bucket - 1)
  );
}

async function readAccountUser(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    include: {
      tenant: { select: { name: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) {
    throw Object.assign(new Error('Profile not found'), { status: 404 });
  }
  return user;
}

export type GenericAccountProfile = Awaited<ReturnType<typeof getGenericProfile>>;

export async function getGenericProfile(userId: string, tenantId: string) {
  const user = await readAccountUser(userId, tenantId);
  return {
    account: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      appType: user.appType,
      branchName: user.branch?.name ?? null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      totpEnabled: Boolean(user.totpSecret),
    },
  };
}

export async function updateGenericProfile(
  context: AccountContext,
  input: { name?: unknown; phone?: unknown },
) {
  const user = await readAccountUser(context.userId, context.tenantId);
  const name = typeof input.name === 'string' ? input.name.trim() : user.name;
  const phone = typeof input.phone === 'string' ? input.phone.trim() : user.phone;

  if (!name) throw Object.assign(new Error('Name is required'), { status: 400 });
  if (!phone) throw Object.assign(new Error('Phone is required'), { status: 400 });

  const conflict = await prisma.user.findFirst({
    where: {
      tenantId: context.tenantId,
      phone,
      id: { not: context.userId },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (conflict) throw Object.assign(new Error('Phone is already used by another user'), { status: 409 });

  const updated = await prisma.user.update({
    where: { id: context.userId },
    data: { name, phone },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'update',
      entityType: 'profile',
      entityId: context.userId,
      oldValue: JSON.stringify({ name: user.name, phone: user.phone }),
      newValue: JSON.stringify({ name: updated.name, phone: updated.phone }),
      ipAddress: context.ip,
      userAgent: context.userAgent ?? undefined,
    },
  }).catch(() => {});

  return getGenericProfile(context.userId, context.tenantId);
}

export async function sendGenericPasswordOtp(context: AccountContext) {
  const user = await readAccountUser(context.userId, context.tenantId);
  if (!user.email) {
    throw Object.assign(new Error('Add an email address before changing your password'), { status: 400 });
  }

  const windowMs = OTP_WINDOW_MS;
  const [userLimit, ipLimit] = await Promise.all([
    checkRateLimit(`account-otp:user:${context.userId}`, { limit: 5, windowMs }),
    checkRateLimit(`account-otp:ip:${context.ip || '0.0.0.0'}`, { limit: 20, windowMs }),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    throw Object.assign(new Error('Too many OTP requests. Try again later.'), { status: 429 });
  }

  const otp = generateAccountOtp(user.id, user.email, otpBucket());
  const brandName = user.tenant?.name || 'LoanTrack';
  const result = await sendEmail(
    context.tenantId,
    user.email,
    `Your ${brandName} account password code`,
    `<p>Hi ${user.name},</p>
     <p>Your account password change code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
     <p>This code expires in 10 minutes.</p>
     <p>If you did not request this, review your account security.</p>`,
    { event: 'account_password_otp', entityType: 'profile', entityId: user.id },
    { system: true },
  );
  if (!result.success) {
    throw Object.assign(new Error(result.error || 'Could not send OTP email'), { status: 500 });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'create',
      entityType: 'profile_password_otp',
      entityId: context.userId,
      newValue: JSON.stringify({ sent: true, dev: Boolean(result.dev) }),
      ipAddress: context.ip,
      userAgent: context.userAgent ?? undefined,
    },
  }).catch(() => {});

  return { sent: true, dev: Boolean(result.dev), email: user.email };
}

export async function changeGenericPasswordWithOtp(
  context: AccountContext,
  input: { otp?: unknown; newPassword?: unknown },
) {
  const user = await readAccountUser(context.userId, context.tenantId);
  if (!user.email) {
    throw Object.assign(new Error('Add an email address before changing your password'), { status: 400 });
  }

  const otp = typeof input.otp === 'string' ? input.otp.trim() : '';
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  if (!otp || !newPassword) {
    throw Object.assign(new Error('OTP and new password are required'), { status: 400 });
  }
  if (newPassword.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  }

  const windowMs = OTP_WINDOW_MS;
  const [userLimit, ipLimit] = await Promise.all([
    checkRateLimit(`account-change:user:${context.userId}`, { limit: 3, windowMs }),
    checkRateLimit(`account-change:ip:${context.ip || '0.0.0.0'}`, { limit: 10, windowMs }),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    throw Object.assign(new Error('Too many attempts. Try again later.'), { status: 429 });
  }
  if (!isValidAccountOtp(user.id, user.email, otp)) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(newPassword, 12) },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'update',
      entityType: 'profile_password',
      entityId: context.userId,
      newValue: JSON.stringify({ changed: true }),
      ipAddress: context.ip,
      userAgent: context.userAgent ?? undefined,
    },
  }).catch(() => {});

  return { changed: true };
}

export function accountProfileErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status) || 500
    : 500;
}
