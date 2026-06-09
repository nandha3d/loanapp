import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hash } from 'bcryptjs';
import { generateTenantSlug } from '@/lib/slug';
import { calculateVerticalSubscriptionPricing, normalizeSelectedModules } from '@/lib/pricing';
import { validateEmail, validateIndianMobile } from '@/lib/validation/contact';
import { sendVerificationEmail } from '@/lib/auth/emailVerification';

export async function POST(request: Request) {
  try {
    // Self-registration is disabled once a client's custom domain is claimed.
    const host = request.headers.get('x-loantrack-host') || request.headers.get('host');
    const { getCustomDomainTenantId, isStandaloneDomainHost } = await import('@/lib/tenant');
    if (await getCustomDomainTenantId(host)) {
      return NextResponse.json({ success: false, error: 'Registration is disabled on this domain.' }, { status: 403 });
    }
    // First signup on a client's own (unclaimed) domain claims it as the
    // lifetime owner with all modules — no plan/addons selection needed.
    const standaloneClaim = isStandaloneDomainHost(host);
    const claimDomain = standaloneClaim ? (host || '').toLowerCase().split(':')[0] : null;

    const body = await request.json();
    const {
      businessName,
      ownerName,
      ownerPhone,
      ownerEmail,
      ownerUsername,
      ownerPassword,
      selectedPlan,
      selectedModules = [],
      selectedAddons = [],
      referralCode
    } = body;

    // Validate fields
    if (!businessName || !ownerName || !ownerPhone || !ownerUsername || !ownerPassword || !selectedPlan) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const emailCheck = validateEmail(ownerEmail);
    if (!emailCheck.ok) {
      return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 });
    }
    const phoneCheck = validateIndianMobile(ownerPhone);
    if (!phoneCheck.ok) {
      return NextResponse.json({ success: false, error: phoneCheck.error }, { status: 400 });
    }
    const email = emailCheck.value;
    const phone = phoneCheck.value;

    const ALL_MODULES_LIST = ['microlending', 'autofinance', 'chitfunds', 'goldloan'];
    const finalModules = standaloneClaim ? ALL_MODULES_LIST : normalizeSelectedModules(selectedModules);

    // Generate unique slug
    const slug = await generateTenantSlug(businessName, finalModules);

    // Fetch plan details from catalog to set limits & snapshot base price.
    // Standalone claims don't use the catalog (lifetime, all modules, no billing).
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

    // Hash password
    const hashedPassword = await hash(ownerPassword, 10);

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug,
          status: 'active',
          // Claim the client's domain on first signup → locks future registration.
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

      // 3. Create TenantSubscription. Standalone claim → lifetime, unlimited,
      // all add-ons off (features controlled later in the admin panel).
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

          // Pricing Snapshots (0 for lifetime).
          basePlanPrice,
          modulesPrice,
          addonsPrice,
          totalMonthlyPrice,

          trialEndsAt
        }
      });

      // 4. Create User (superadmin owner)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: ownerName,
          phone,
          email,
          username: ownerUsername.trim().toLowerCase(),
          passwordHash: hashedPassword,
          role: 'superadmin',
          appType: finalModules[0],
          // Account stays inactive until the owner verifies their email.
          status: 'pending',
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

      // Create an audit log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'create',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: JSON.stringify({ name: businessName, slug, owner: ownerName })
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
              referredEmail: user.email || ownerUsername + '@' + tenant.slug + '.com',
              status: 'signup'
            }
          });
        }
      }

      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        username: user.username,
        userId: user.id,
        ownerEmail: email,
        ownerName,
      };
    });

    // Send the activation email outside the transaction (network call).
    // When Supabase auth is configured it owns email delivery + ownership proof
    // (the client triggers a Supabase magic-link after this response), so skip
    // the legacy Brevo verification mail to avoid a duplicate email.
    const { isSupabaseConfigured } = await import('@/lib/supabase/server');
    if (!isSupabaseConfigured()) {
      await sendVerificationEmail({
        tenantId: result.tenantId,
        email: result.ownerEmail,
        name: result.ownerName,
        userId: result.userId,
      }).catch((e) => console.error('[VERIFY_EMAIL_SEND]', e));
    }

    return NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        message: 'Account created. Check your email to verify and activate your account.',
        tenantId: result.tenantId,
        tenantSlug: result.tenantSlug,
        username: result.username
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[EMAIL_REGISTER_ERROR]', err);
    if (err.code === 'P2002') {
      const target = err.meta?.target || '';
      if (target.includes('username')) {
        return NextResponse.json(
          { success: false, error: 'Username is already taken by another account.' },
          { status: 409 }
        );
      }
      if (target.includes('phone')) {
        return NextResponse.json(
          { success: false, error: 'Phone number is already registered.' },
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
