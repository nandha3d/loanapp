import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateTenantSlug } from '@/lib/slug';
import { calculateVerticalSubscriptionPricing, normalizeSelectedModules } from '@/lib/pricing';
import { validateIndianMobile } from '@/lib/validation/contact';
import { findUserUniqueConflicts } from '@/lib/userUniqueness';

export async function POST(request: Request) {
  try {
    // Self-registration is disabled once a client's custom domain is claimed.
    const host = request.headers.get('x-loantrack-host') || request.headers.get('host');
    const { getCustomDomainTenantId, isStandaloneDomainHost } = await import('@/lib/tenant');
    if (await getCustomDomainTenantId(host)) {
      return NextResponse.json({ success: false, error: 'Registration is disabled on this domain.' }, { status: 403 });
    }
    const standaloneClaim = isStandaloneDomainHost(host);
    const claimDomain = standaloneClaim ? (host || '').toLowerCase().split(':')[0] : null;

    const body = await request.json();
    const {
      idToken,
      supabaseAccessToken,
      googleId: directGoogleId,
      ownerEmail: directEmail,
      ownerName: directName,
      businessName,
      ownerPhone,
      selectedPlan,
      selectedModules = [],
      selectedAddons = [],
      referralCode
    } = body;

    // Validate fields
    if (!businessName || !ownerPhone || !selectedPlan) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let googleId = directGoogleId;
    let email = directEmail;
    let name = directName || 'Google User';

    // Preferred path: a verified Supabase session token from the OAuth handshake.
    // Supabase brokered Google, so the email is already proven; we use the
    // Supabase user id as the stable external identity (googleId).
    if (supabaseAccessToken) {
      const { verifySupabaseToken } = await import('@/lib/supabase/server');
      const identity = await verifySupabaseToken(String(supabaseAccessToken));
      if (!identity) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired Google session' },
          { status: 401 }
        );
      }
      email = identity.email;
      name = identity.name || name;
      googleId = identity.supabaseUserId;
    }

    if (idToken) {
      // Verify Google ID token using Google API
      const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const tokenResponse = await fetch(tokenInfoUrl);
      
      if (!tokenResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Invalid Google ID token' },
          { status: 401 }
        );
      }

      const payload = await tokenResponse.json();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name || name;
    }

    if (!googleId || !email) {
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve Google profile details' },
        { status: 400 }
      );
    }

    const phoneCheck = validateIndianMobile(ownerPhone);
    if (!phoneCheck.ok) {
      return NextResponse.json({ success: false, error: phoneCheck.error }, { status: 400 });
    }
    const phone = phoneCheck.value;
    // Phone number doubles as the default login username.
    const username = phone;

    // ── 2. Reject duplicates with a field-specific message ──
    const conflicts = await findUserUniqueConflicts({ username, phone, email });
    if (conflicts.length > 0) {
      return NextResponse.json({ success: false, error: conflicts[0].message }, { status: 409 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { googleId },
      select: { id: true, tenant: { select: { slug: true } } }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this Google account is already registered.',
          existingTenantSlug: existingUser.tenant.slug
        },
        { status: 409 }
      );
    }

    const ALL_MODULES_LIST = ['microlending', 'autofinance', 'chitfunds', 'goldloan', 'property', 'productfinance'];
    const finalModules = standaloneClaim ? ALL_MODULES_LIST : normalizeSelectedModules(selectedModules);

    // Generate unique slug
    const slug = await generateTenantSlug(businessName, finalModules);

    // Fetch plan details from catalog (skipped for a standalone lifetime claim).
    const planCatalog = await prisma.subscriptionPlanCatalog.findUnique({
      where: { plan: selectedPlan }
    });

    if (!planCatalog && !standaloneClaim) {
      return NextResponse.json(
        { success: false, error: `Selected plan "${selectedPlan}" not found in catalog` },
        { status: 400 }
      );
    }

    let basePlanPrice = 0, modulesPrice = 0, addonsPrice = 0, totalMonthlyPrice = 0;
    if (!standaloneClaim) {
      const addonsCatalog = await prisma.addonCatalog.findMany({
        where: { addon: { in: selectedAddons } }
      });
      addonsPrice = addonsCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);
      ({ basePlanPrice, modulesPrice, totalMonthlyPrice } = calculateVerticalSubscriptionPricing(
        planCatalog!.monthlyPrice,
        finalModules,
        addonsPrice
      ));
    }

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug,
          status: 'active',
          ...(claimDomain ? { customDomain: claimDomain } : {}),
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

      // 3. Create TenantSubscription (lifetime + unlimited for a standalone claim).
      // Paid plans get a free trial, then must subscribe (trial gate enforced in
      // assertTenantSubscriptionAccess). Free plan stays free; standalone=lifetime.
      const PAID_PLANS = ['basic', 'business', 'enterprise'];
      const trialDays = standaloneClaim
        ? 0
        : PAID_PLANS.includes(selectedPlan)
          ? (((planCatalog as any)?.trialDays ?? 0) || 14)
          : 0;
      const trialEndsAt = trialDays > 0
        ? (() => { const d = new Date(); d.setDate(d.getDate() + trialDays); d.setHours(23,59,59,999); return d; })()
        : null;

      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan: standaloneClaim ? 'lifetime' : selectedPlan,
          status: 'active',
          maxActiveLoans: standaloneClaim ? 999999 : planCatalog!.maxActiveLoans,
          maxAgents: standaloneClaim ? 999 : planCatalog!.maxAgents,
          maxBranches: standaloneClaim ? 999 : planCatalog!.maxBranches,
          enabledModules: JSON.stringify(finalModules),
          selectedAddons: JSON.stringify(standaloneClaim ? [] : selectedAddons),

          // Add-on flags (all off for a fresh standalone claim).
          whatsappSmsEnabled: !standaloneClaim && selectedAddons.includes('whatsapp_sms'),
          kycEnabled: !standaloneClaim && selectedAddons.includes('kyc'),
          gpsTrackingEnabled: !standaloneClaim && selectedAddons.includes('gps_tracking'),
          premiumAccountingEnabled: !standaloneClaim && selectedAddons.includes('premium_accounting'),
          bureauEnabled: !standaloneClaim && selectedAddons.includes('bureau'),

          // Pricing Snapshots
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
          phone,
          email,
          username,
          googleId,
          role: 'superadmin',
          appType: finalModules[0],
          status: 'active',
          canCreateLoan: true
        }
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
          newValue: JSON.stringify({ name: businessName, slug, owner: name, type: 'google' })
        }
      });

      // Attribution hook: link referral code
      if (referralCode) {
        const affiliate = await tx.affiliate.findUnique({
          where: { code: referralCode }
        });
        if (affiliate) {
          await tx.referral.create({
            data: {
              affiliateId: affiliate.id,
              referredTenantId: tenant.id,
              referredEmail: email,
              status: 'signup'
            }
          });
        }
      }

      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        username: user.username
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Tenant registered successfully via Google',
        tenantId: result.tenantId,
        tenantSlug: result.tenantSlug,
        username: result.username
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[GOOGLE_REGISTER_ERROR]', err);
    if (err.code === 'P2002') {
      const target = err.meta?.target || '';
      if (target.includes('phone')) {
        return NextResponse.json(
          { success: false, error: 'This phone number already exists.' },
          { status: 409 }
        );
      }
      if (target.includes('email')) {
        return NextResponse.json(
          { success: false, error: 'This email already exists.' },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { success: false, error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
