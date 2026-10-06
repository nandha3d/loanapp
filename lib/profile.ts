import { createHmac } from 'crypto';
import { hash } from 'bcryptjs';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/notify/channels/email';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizeEnabledModules } from '@/lib/subscription';
import { cheapestPlanByFeature, PLAN_FEATURES } from '@/lib/planFeatures';
import { normalizeBillingCycle } from '@/lib/razorpay';
import { MODULE_LABELS } from '@/types/modules';

const OTP_WINDOW_MS = 10 * 60 * 1000;

type ProfileContext = {
  userId: string;
  tenantId: string;
  ip?: string;
  userAgent?: string | null;
};

export type SuperadminProfile = Awaited<ReturnType<typeof getSuperadminProfile>>;

function otpBucket(now = Date.now()) {
  return Math.floor(now / OTP_WINDOW_MS);
}

function generateProfileOtp(userId: string, email: string, bucket: number): string {
  // No fallback: with a public constant, OTPs would be forgeable by anyone.
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for profile OTP generation');
  const raw = createHmac('sha256', secret)
    .update(`profile-password:${userId}:${email.toLowerCase()}:${bucket}`)
    .digest('hex');
  return String(parseInt(raw.substring(0, 8), 16) % 1_000_000).padStart(6, '0');
}

function isValidProfileOtp(userId: string, email: string, otp: string): boolean {
  const bucket = otpBucket();
  return (
    otp === generateProfileOtp(userId, email, bucket) ||
    otp === generateProfileOtp(userId, email, bucket - 1)
  );
}

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function limitText(value: number | null | undefined, unlimitedValue: number) {
  if (value == null) return 'Not set';
  return value >= unlimitedValue ? 'Unlimited' : value.toLocaleString('en-IN');
}

async function readSuperadminUser(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'superadmin', deletedAt: null },
    include: {
      tenant: { select: { id: true, name: true, slug: true, customDomain: true, status: true, createdAt: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) {
    throw Object.assign(new Error('Superadmin profile not found'), { status: 404 });
  }
  return user;
}

export async function getSuperadminProfile(userId: string, tenantId: string) {
  const user = await readSuperadminUser(userId, tenantId);

  const [subscription, invoices, usage] = await Promise.all([
    prisma.tenantSubscription.findUnique({ where: { tenantId } }),
    prisma.billingInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    Promise.all([
      prisma.loan.count({ where: { tenantId, status: 'active', deletedAt: null } }),
      prisma.user.count({ where: { tenantId, role: 'agent', status: 'active', deletedAt: null } }),
      prisma.branch.count({ where: { tenantId, status: 'active', deletedAt: null } }),
    ]),
  ]);

  const plan = subscription?.plan || 'trial';
  const [catalog, activeCatalog] = await Promise.all([
    prisma.subscriptionPlanCatalog.findUnique({ where: { plan } }).catch(() => null),
    prisma.subscriptionPlanCatalog
      .findMany({
        where: { isActive: true },
        select: { displayName: true, monthlyPrice: true, includedFeatures: true },
      })
      .catch(() => []),
  ]);
  const enabledModules = normalizeEnabledModules(subscription?.enabledModules);
  const selectedAddons = safeJsonArray(subscription?.selectedAddons);
  // Same "cheapest plan that includes it" the web subscription page shows.
  const featurePlans = cheapestPlanByFeature(activeCatalog);
  const includedIn = (flag: string) => {
    const key = PLAN_FEATURES.find((f) => f.flag === flag)?.key;
    return key ? featurePlans[key] : null;
  };
  const addOns = [
    { key: 'whatsappSmsEnabled', label: 'WhatsApp & SMS', enabled: Boolean(subscription?.whatsappSmsEnabled) },
    { key: 'receiptPdfAllowed', label: 'Receipt PDFs', enabled: Boolean(subscription?.receiptPdfAllowed) },
    { key: 'bureauEnabled', label: 'Credit Bureau', enabled: Boolean(subscription?.bureauEnabled) },
    { key: 'npaEnabled', label: 'NPA Engine', enabled: Boolean(subscription?.npaEnabled) },
    { key: 'foreclosureEnabled', label: 'Preclose & Early Settlement', enabled: Boolean(subscription?.foreclosureEnabled) },
    { key: 'nachEnabled', label: 'eNACH Mandates', enabled: Boolean(subscription?.nachEnabled) },
    { key: 'kycEnabled', label: 'Aadhaar/Video KYC', enabled: Boolean(subscription?.kycEnabled) },
    { key: 'gpsTrackingEnabled', label: 'GPS Tracking', enabled: Boolean(subscription?.gpsTrackingEnabled) },
    { key: 'premiumAccountingEnabled', label: 'Premium Accounting', enabled: Boolean(subscription?.premiumAccountingEnabled) },
  ].map((addOn) => ({
    ...addOn,
    featureKey: PLAN_FEATURES.find((f) => f.flag === addOn.key)?.key ?? null,
    includedIn: addOn.enabled ? null : includedIn(addOn.key),
  }));

  // What the tenant actually pays and when it ends, worked out exactly as the
  // web My Subscription page does (the stored `pricing` multiplies the plan
  // price by the number of verticals, which is not what is billed).
  const billingCycle = normalizeBillingCycle(subscription?.billingCycle);
  const yearlyOffered = (catalog?.yearlyPrice ?? 0) > 0;
  const billedYearly = billingCycle === 'yearly' && yearlyOffered;
  const planPrice = {
    amount: billedYearly ? (catalog?.yearlyPrice ?? 0) : (catalog?.monthlyPrice ?? subscription?.basePlanPrice ?? 0),
    cycle: billedYearly ? 'yearly' : 'monthly',
  };
  const expiry = (() => {
    if (plan === 'trial') {
      return { kind: 'trial', date: subscription?.trialEndsAt?.toISOString() ?? null };
    }
    const end = subscription?.currentPeriodEnd?.toISOString() ?? null;
    return { kind: end ? 'renewal' : 'none', date: end };
  })();

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
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      totpEnabled: Boolean(user.totpSecret),
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      customDomain: user.tenant.customDomain,
      status: user.tenant.status,
      createdAt: user.tenant.createdAt.toISOString(),
    },
    subscription: subscription
      ? {
          id: subscription.id,
          plan,
          planLabel: catalog?.displayName || plan,
          planDescription: catalog?.description ?? null,
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          gracePeriodEnd: subscription.gracePeriodEnd?.toISOString() ?? null,
          maxActiveLoans: subscription.maxActiveLoans,
          maxAgents: subscription.maxAgents,
          maxBranches: subscription.maxBranches,
          enabledModules: enabledModules.map((module) => ({
            key: module,
            label: (MODULE_LABELS as Record<string, string>)[module] || module,
          })),
          selectedAddons,
          addOns,
          billingCycle,
          planPrice,
          expiry,
          pricing: {
            basePlanPrice: subscription.basePlanPrice,
            modulesPrice: subscription.modulesPrice,
            addonsPrice: subscription.addonsPrice,
            totalMonthlyPrice: subscription.totalMonthlyPrice,
          },
        }
      : null,
    usage: {
      activeLoans: usage[0],
      activeAgents: usage[1],
      activeBranches: usage[2],
      limits: {
        activeLoans: limitText(subscription?.maxActiveLoans, 999999),
        agents: limitText(subscription?.maxAgents, 999),
        branches: limitText(subscription?.maxBranches, 999),
      },
    },
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      amount: Number(invoice.amount),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
      invoiceUrl: invoice.invoiceUrl,
      billingPeriod: invoice.billingPeriod,
      createdAt: invoice.createdAt.toISOString(),
    })),
  };
}

export async function updateSuperadminProfile(
  context: ProfileContext,
  input: { name?: unknown; phone?: unknown },
) {
  const user = await readSuperadminUser(context.userId, context.tenantId);
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

  return getSuperadminProfile(context.userId, context.tenantId);
}

export async function sendSuperadminPasswordOtp(context: ProfileContext) {
  const user = await readSuperadminUser(context.userId, context.tenantId);
  if (!user.email) {
    throw Object.assign(new Error('Add an email address before changing your password'), { status: 400 });
  }

  const windowMs = OTP_WINDOW_MS;
  const [userLimit, ipLimit] = await Promise.all([
    checkRateLimit(`profile-otp:user:${context.userId}`, { limit: 5, windowMs }),
    checkRateLimit(`profile-otp:ip:${context.ip || '0.0.0.0'}`, { limit: 20, windowMs }),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    throw Object.assign(new Error('Too many OTP requests. Try again later.'), { status: 429 });
  }

  const otp = generateProfileOtp(user.id, user.email, otpBucket());
  const brandName = user.tenant.name || 'ZoloFund';
  const result = await sendEmail(
    context.tenantId,
    user.email,
    `Your ${brandName} profile password code`,
    `<p>Hi ${user.name},</p>
     <p>Your profile password change code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
     <p>This code expires in 10 minutes.</p>
     <p>If you did not request this, review your account security.</p>`,
    { event: 'profile_password_otp', entityType: 'profile', entityId: user.id },
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

export async function changeSuperadminPasswordWithOtp(
  context: ProfileContext,
  input: { otp?: unknown; newPassword?: unknown },
) {
  const user = await readSuperadminUser(context.userId, context.tenantId);
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
    checkRateLimit(`profile-change:user:${context.userId}`, { limit: 3, windowMs }),
    checkRateLimit(`profile-change:ip:${context.ip || '0.0.0.0'}`, { limit: 10, windowMs }),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    throw Object.assign(new Error('Too many attempts. Try again later.'), { status: 429 });
  }
  if (!isValidProfileOtp(user.id, user.email, otp)) {
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

export function profileErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status) || 500
    : 500;
}
