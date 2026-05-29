import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hash } from 'bcryptjs';
import { generateTenantSlug } from '@/lib/slug';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken } from '@/lib/api/v1-auth';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null));
    if (!body) {
      return fail('Invalid request body', 400);
    }

    const {
      businessName,
      ownerName,
      ownerPhone,
      ownerUsername,
      ownerPassword,
      selectedPlan,
      selectedModules = [],
      selectedAddons = []
    } = body;

    // Validate fields
    if (!businessName || !ownerName || !ownerPhone || !ownerUsername || !ownerPassword || !selectedPlan) {
      return fail('Missing required fields', 400);
    }

    const finalModules = selectedModules.length > 0 ? selectedModules : ['microlending'];

    // Generate unique slug
    const slug = await generateTenantSlug(businessName, finalModules);

    // Fetch plan details from catalog
    const planCatalog = await prisma.subscriptionPlanCatalog.findUnique({
      where: { plan: selectedPlan }
    });

    if (!planCatalog) {
      return fail(`Selected plan "${selectedPlan}" not found in catalog`, 400);
    }

    // Fetch module/addon prices snapshots
    const modulesCatalog = await prisma.modulePriceCatalog.findMany({
      where: { module: { in: finalModules } }
    });
    const basePlanPrice = planCatalog.monthlyPrice;
    const modulesPrice = modulesCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);

    const addonsCatalog = await prisma.addonCatalog.findMany({
      where: { addon: { in: selectedAddons } }
    });
    const addonsPrice = addonsCatalog.reduce((sum, item) => sum + item.monthlyPrice, 0);
    const totalMonthlyPrice = basePlanPrice + modulesPrice + addonsPrice;

    // Hash password
    const hashedPassword = await hash(ownerPassword, 10);

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
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
          phone: ownerPhone,
          username: ownerUsername.trim().toLowerCase(),
          passwordHash: hashedPassword,
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

      // Create an audit log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'create',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: JSON.stringify({ name: businessName, slug, owner: ownerName, source: 'mobile' })
        }
      });

      return user;
    });

    const token = await issueMobileToken({
      userId: result.id,
      tenantId: result.tenantId,
      branchId: result.branchId,
      role: result.role,
      appType: result.appType,
    });

    return ok({
      token,
      user: serializeUser(result),
    });
  } catch (err: any) {
    console.error('[MOBILE_REGISTER_ERROR]', err);
    if (err.code === 'P2002') {
      const target = err.meta?.target || '';
      if (target.includes('username')) {
        return fail('Username is already taken by another account.', 409);
      }
      if (target.includes('phone')) {
        return fail('Phone number is already registered.', 409);
      }
    }
    return fail(err.message || 'Registration failed', 500);
  }
}

function serializeUser(user: any) {
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
    enabledModules: enabledModulesForRole(user.role, user.appType),
  };
}

function enabledModulesForRole(role: string, _appType: string): string[] {
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
