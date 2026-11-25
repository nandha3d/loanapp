import { planFeatureUpdate } from '@/lib/planFeatures';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { generateTenantSlug } from '@/lib/slug';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken, issueRefreshToken, loginWindowFailure, resolveUserVerticals } from '@/lib/api/v1-auth';
import { calculateVerticalSubscriptionPricing, normalizeSelectedModules } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null));
    if (!body?.idToken) {
      return fail('idToken is required', 400);
    }

    const {
      idToken,
      businessName,
      ownerPhone,
      selectedPlan,
      selectedModules = [],
      selectedAddons: _legacyAddons = [],
      referralCode,
    } = body;
    // Add-ons are bundled into plans (planFeatures.ts); any client-sent list is ignored.
    const selectedAddons: string[] = [];

    // ── 1. Verify Google ID token using Google API ───────────────────────────
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const tokenResponse = await fetch(tokenInfoUrl);
    
    if (!tokenResponse.ok) {
      return fail('Invalid Google ID token', 401);
    }

    const payload = await tokenResponse.json();
    const googleId = payload.sub ? String(payload.sub) : '';
    const email = payload.email ? String(payload.email).trim().toLowerCase() : '';
    const name = payload.name || 'Google User';

    if (!googleId || !email) {
      return fail('Failed to retrieve Google profile details', 400);
    }

    const explicitSlug =
      (body?.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null) ||
      req.headers.get('x-tenant-slug')?.trim().toLowerCase() ||
      null;

    // ── 2. Check if user already exists ──────────────────────────────────────
    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [{ googleId }, { email }],
        deletedAt: null,
        ...(explicitSlug
          ? { tenant: { OR: [{ slug: explicitSlug }, { customDomain: explicitSlug }], status: 'active' } }
          : { tenant: { status: 'active' } }),
      },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true,
            status: true,
            subscription: {
              select: {
                gpsTrackingEnabled: true,
                npaEnabled: true,
                kycEnabled: true,
                bureauEnabled: true,
                premiumAccountingEnabled: true,
                whatsappSmsEnabled: true,
                foreclosureEnabled: true,
              },
            },
          },
        },
      },
      take: 10,
    });

    const distinctTenantIds = new Set(matchingUsers.map((u) => u.tenantId));
    if (distinctTenantIds.size > 1) {
      return ok({
        requiresTenant: true,
        tenants: matchingUsers.map((u) => ({ slug: u.tenant.slug, name: u.tenant.name })),
        email,
        name,
      });
    }

    const existingUser =
      matchingUsers.find((u) => u.googleId === googleId) ?? matchingUsers[0] ?? null;

    if (existingUser) {
      if (existingUser.tenant.status !== 'active') {
        return fail('Account tenant is inactive', 403);
      }

      if (existingUser.status !== 'active' && existingUser.status !== 'pending') {
        return fail('Account is inactive or suspended.', 403);
      }

      const windowFailure = loginWindowFailure(existingUser);
      if (windowFailure) return windowFailure;

      // Activate pending account + link Google ID when email matches.
      const patch: Record<string, unknown> = { lastLoginAt: new Date() };
      if (existingUser.status === 'pending') patch.status = 'active';
      if (!existingUser.googleId) patch.googleId = googleId;
      await prisma.user.update({ where: { id: existingUser.id }, data: patch }).catch(() => {});

      const [token, refreshToken, verticals] = await Promise.all([
        issueMobileToken({
          userId: existingUser.id,
          tenantId: existingUser.tenantId,
          branchId: existingUser.branchId,
          role: existingUser.role,
          appType: existingUser.appType,
        }),
        issueRefreshToken(existingUser.id, existingUser.tenantId).catch(() => null),
        resolveUserVerticals(existingUser),
      ]);

      return ok({
        token,
        refreshToken,
        user: serializeUser(existingUser, verticals),
      });
    }

    // ── 3. If user doesn't exist, check if we have registration parameters ──
    if (!businessName || !ownerPhone || !selectedPlan) {
      // Return details back to client to let them complete registration screen
      return ok({
        needsRegistration: true,
        email,
        name
      });
    }

    const finalModules = normalizeSelectedModules(selectedModules);

    // Generate unique slug
    const slug = await generateTenantSlug(businessName, finalModules);

    // Fetch plan details from catalog
    const planCatalog = await prisma.subscriptionPlanCatalog.findUnique({
      where: { plan: selectedPlan }
    });

    if (!planCatalog) {
      return fail(`Selected plan "${selectedPlan}" not found in catalog`, 400);
    }

    const addonsCatalog = await prisma.addonCatalog.findMany({
      where: { addon: { in: selectedAddons } }
    });
    const addonsPrice = addonsCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);
    const { basePlanPrice, modulesPrice, totalMonthlyPrice } = calculateVerticalSubscriptionPricing(
      planCatalog.monthlyPrice,
      finalModules,
      addonsPrice
    );

    // Generate unique username from email prefix
    let username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!username) username = 'user';

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug,
          status: 'active'
        }
      });

      // 2. Create default Branch
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Head Office',
          code: 'HQ',
          status: 'active',
          enabledModules: JSON.stringify(finalModules)
        }
      });

      // 3. Create TenantSubscription
      const trialDays = (planCatalog as any).trialDays ?? 0;
      const trialEndsAt = trialDays > 0
        ? (() => { const d = new Date(); d.setDate(d.getDate() + trialDays); d.setHours(23,59,59,999); return d; })()
        : null;

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan: selectedPlan,
          status: 'active',
          maxActiveLoans: planCatalog.maxActiveLoans,
          maxAgents: planCatalog.maxAgents,
          maxBranches: planCatalog.maxBranches,
          enabledModules: JSON.stringify(finalModules),
          selectedAddons: JSON.stringify(selectedAddons),
          
          whatsappSmsEnabled: selectedAddons.includes('whatsapp_sms'),
          kycEnabled: selectedAddons.includes('kyc'),
          gpsTrackingEnabled: selectedAddons.includes('gps_tracking'),
          premiumAccountingEnabled: selectedAddons.includes('premium_accounting'),
          bureauEnabled: selectedAddons.includes('bureau'),
          npaEnabled: selectedAddons.includes('npa'),
          ...(planCatalog ? planFeatureUpdate(planCatalog, { plan: '' }) : null),

          basePlanPrice,
          modulesPrice,
          addonsPrice,
          totalMonthlyPrice,

          trialEndsAt
        }
      });

      // 4. Create User (superadmin owner) with googleId and no password
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name,
          phone: ownerPhone,
          email,
          username,
          googleId,
          role: 'superadmin',
          appType: finalModules[0],
          status: 'active',
          canCreateLoan: true
        },
        include: { tenant: { select: { slug: true } } }
      });

      // 5. Update branch to link the superadmin owner
      await tx.branch.update({
        where: { id: branch.id },
        data: { superadminId: user.id }
      });

      // Create a join entry in SuperadminBranch table
      await tx.superadminBranch.create({
        data: {
          superadminId: user.id,
          branchId: branch.id,
          assignedById: user.id
        }
      });

      // Add default app settings for branding
      const defaultSettings = [
        { key: 'app_name', value: businessName, group: 'branding' },
        { key: 'app_tagline', value: 'Micro-Lending Management System', group: 'branding' },
        { key: 'logo_url', value: '/assets/logo.svg', group: 'branding' },
        { key: 'primary_color', value: '#F5A623', group: 'branding' },
        { key: 'primary_dark', value: '#E8930C', group: 'branding' },
        { key: 'timezone', value: 'Asia/Kolkata', group: 'system' },
        { key: 'currency', value: 'INR', group: 'system' },
        { key: 'currency_symbol', value: '₹', group: 'system' },
        { key: 'date_format', value: 'dd MMM yyyy', group: 'system' },
        { key: 'midnight_cutoff', value: 'true', group: 'system' },
        { key: 'allow_weekend_collection', value: 'false', group: 'system' },
        { key: 'default_penalty_per_day', value: '50', group: 'penalty' },
        { key: 'penalty_grace_period', value: '0', group: 'penalty' },
        { key: 'penalty_max_cap', value: '0', group: 'penalty' },
        { key: 'customer_code_prefix', value: 'CUS', group: 'general' },
        { key: 'loan_code_prefix', value: 'LN', group: 'general' },
        { key: 'customer_code_counter', value: '0', group: 'general' },
        { key: 'loan_code_counter', value: '0', group: 'general' }
      ];

      await tx.appSetting.createMany({
        data: defaultSettings.map(s => ({
          tenantId: tenant.id,
          ...s
        }))
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'create',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: JSON.stringify({ name: businessName, slug, owner: name, type: 'google', source: 'mobile' })
        }
      });

      // Attribution hook: link referral code (mirrors web /api/register/google)
      if (referralCode) {
        const affiliate = await tx.affiliate.findUnique({
          where: { code: referralCode },
        });
        if (affiliate) {
          await tx.referral.create({
            data: {
              affiliateId: affiliate.id,
              referredTenantId: tenant.id,
              referredEmail: email,
              status: 'signup',
            },
          });
        }
      }

      return user;
    });

    const [token, refreshToken, verticals] = await Promise.all([
      issueMobileToken({
        userId: result.id,
        tenantId: result.tenantId,
        branchId: result.branchId,
        role: result.role,
        appType: result.appType,
      }),
      issueRefreshToken(result.id, result.tenantId).catch(() => null),
      resolveUserVerticals(result),
    ]);

    return ok({
      token,
      refreshToken,
      user: serializeUser(result, verticals),
    });
  } catch (err: any) {
    console.error('[MOBILE_GOOGLE_AUTH_ERROR]', err);
    if (err.code === 'P2002') {
      const target = err.meta?.target || '';
      if (target.includes('phone')) {
        return fail('Phone number is already registered.', 409);
      }
    }
    return fail(err.message || 'Authentication failed', 500);
  }
}

function serializeUser(user: any, verticals: string[] = []) {
  const sub = user.tenant?.subscription;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    appType: user.appType,
    status: user.status,
    totpEnabled: Boolean(user.totpSecret),
    tenantSlug: user.tenant?.slug ?? null,
    gpsTrackingEnabled: Boolean(sub?.gpsTrackingEnabled),
    npaEnabled: Boolean(sub?.npaEnabled),
    kycEnabled: Boolean(sub?.kycEnabled),
    bureauEnabled: Boolean(sub?.bureauEnabled),
    premiumAccountingEnabled: Boolean(sub?.premiumAccountingEnabled),
    whatsappSmsEnabled: Boolean(sub?.whatsappSmsEnabled),
    foreclosureEnabled: Boolean(sub?.foreclosureEnabled),
    enabledModules: enabledModulesForRole(user.role, user.appType),
    verticals,
  };
}

function enabledModulesForRole(role: string, appType: string): string[] {
  if (appType === 'chitfunds') {
    const chitBase = ['dashboard', 'customers', 'chits', 'collection'];
    if (role === 'agent') return chitBase;
    return [...chitBase, 'accounting', 'reports', 'settings'];
  }
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
