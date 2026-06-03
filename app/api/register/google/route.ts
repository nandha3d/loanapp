import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateTenantSlug } from '@/lib/slug';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      idToken,
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

    // ── 2. Check if user already exists in any tenant with this email or googleId ──
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email }
        ]
      },
      select: { id: true, tenant: { select: { slug: true } } }
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'An account with this email/Google account is already registered.',
          existingTenantSlug: existingUser.tenant.slug 
        },
        { status: 409 }
      );
    }

    // Ensure selectedModules includes microlending by default if empty
    const finalModules = selectedModules.length > 0 ? selectedModules : ['microlending'];

    // Generate unique slug
    const slug = await generateTenantSlug(businessName, finalModules);

    // Fetch plan details from catalog
    const planCatalog = await prisma.subscriptionPlanCatalog.findUnique({
      where: { plan: selectedPlan }
    });

    if (!planCatalog) {
      return NextResponse.json(
        { success: false, error: `Selected plan "${selectedPlan}" not found in catalog` },
        { status: 400 }
      );
    }

    // Fetch module prices snapshots
    const modulesCatalog = await prisma.modulePriceCatalog.findMany({
      where: { module: { in: finalModules } }
    });
    const basePlanPrice = planCatalog.monthlyPrice;
    const modulesPrice = modulesCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);

    // Fetch addons price snapshots
    const addonsCatalog = await prisma.addonCatalog.findMany({
      where: { addon: { in: selectedAddons } }
    });
    const addonsPrice = addonsCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);
    const totalMonthlyPrice = basePlanPrice + modulesPrice + addonsPrice;

    // Generate unique username from email prefix (e.g. karthik from karthik@gmail.com)
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

      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan: selectedPlan,
          status: 'active',
          maxActiveLoans: planCatalog.maxActiveLoans,
          maxAgents: planCatalog.maxAgents,
          maxBranches: planCatalog.maxBranches,
          enabledModules: JSON.stringify(finalModules),
          selectedAddons: JSON.stringify(selectedAddons),
          
          // Set boolean flags mapped from selected addons
          whatsappSmsEnabled: selectedAddons.includes('whatsapp_sms'),
          kycEnabled: selectedAddons.includes('kyc'),
          gpsTrackingEnabled: selectedAddons.includes('gps_tracking'),
          premiumAccountingEnabled: selectedAddons.includes('premium_accounting'),
          bureauEnabled: selectedAddons.includes('bureau'),

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
          phone: ownerPhone,
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
