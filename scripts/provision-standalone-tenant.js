/**
 * Provision a STANDALONE client tenant on its own custom domain, without going
 * through public self-registration.
 *
 * Mirrors the `standaloneClaim` branch of app/api/register/email/route.ts:
 * lifetime plan (never billed, never expires — lib/subscription.ts:66), all
 * modules, add-ons off, HQ branch, owner superadmin. Difference: the owner is
 * created `active` (no magic-link verification step), because provisioning here
 * is deliberate rather than a self-signup.
 *
 * Claiming the domain also LOCKS self-registration on that host
 * (app/api/host/registration/route.ts) — by design: extra owners are added
 * in-app only.
 *
 * One host maps to exactly one tenant (Tenant.customDomain is @unique), so this
 * refuses to run if the domain is already claimed.
 *
 * Usage (PowerShell):
 *   $env:BUSINESS_NAME='Erode_Manoj'; $env:CUSTOM_DOMAIN='loan.samuraibuiness.in'
 *   $env:OWNER_NAME='Manoj'; $env:OWNER_PHONE='9998887701'
 *   $env:OWNER_USERNAME='manoj'; $env:OWNER_PASSWORD='...'
 *   node scripts/provision-standalone-tenant.js
 *
 * Optional: OWNER_EMAIL, HQ_BRANCH_NAME (default "Head Office"), HQ_BRANCH_CODE
 * (default "HQ"), DRY_RUN=1 to validate without writing.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Kept in sync with app/api/register/email/route.ts ALL_MODULES_LIST.
const ALL_MODULES = ['microlending', 'autofinance', 'chitfunds', 'goldloan', 'property', 'productfinance'];
// lib/slug.ts
const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'portal', 'support', 'static', 'assets', 'default'];
const MODULE_CODES = { microlending: 'ml', autofinance: 'af', chitfunds: 'cf' };

function required(key) {
  const value = (process.env[key] || '').trim();
  if (!value) throw new Error(`Set ${key} before running this script.`);
  return value;
}

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueTenantSlug(businessName, modules) {
  const codes = ['microlending', 'autofinance', 'chitfunds']
    .filter((m) => modules.includes(m))
    .map((m) => MODULE_CODES[m]);
  let base = slugify(businessName) || 'tenant';
  if (codes.length > 0) base = `${base}-${codes.join('-')}`;

  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (RESERVED_SLUGS.includes(slug) || (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }))) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function main() {
  const businessName = required('BUSINESS_NAME');
  const customDomain = required('CUSTOM_DOMAIN').toLowerCase().split(':')[0];
  const ownerName = required('OWNER_NAME');
  const phone = required('OWNER_PHONE');
  const username = required('OWNER_USERNAME').toLowerCase();
  const email = (process.env.OWNER_EMAIL || '').trim().toLowerCase() || null;
  const branchName = process.env.HQ_BRANCH_NAME || 'Head Office';
  const branchCode = process.env.HQ_BRANCH_CODE || 'HQ';
  const dryRun = process.env.DRY_RUN === '1';

  // Never bake a default password into the script — require it explicitly.
  const rawPassword = process.env.OWNER_PASSWORD;
  if (!rawPassword || rawPassword.length < 8) {
    throw new Error('Set OWNER_PASSWORD (min 8 chars) before running this script.');
  }

  if (!customDomain.includes('.')) {
    throw new Error(`CUSTOM_DOMAIN "${customDomain}" is not a real domain — host→tenant lookup would never match it.`);
  }

  // One host = one tenant.
  const claimed = await prisma.tenant.findUnique({
    where: { customDomain },
    select: { id: true, name: true, slug: true },
  });
  if (claimed) {
    throw new Error(
      `Domain "${customDomain}" is already claimed by tenant "${claimed.name}" (${claimed.slug}). ` +
      `A host maps to exactly one tenant — use a different hostname, or add this business as a branch of that tenant.`
    );
  }

  // Username/phone/email uniqueness is enforced GLOBALLY by the app
  // (lib/userUniqueness.ts), not just per tenant — match that here.
  for (const [field, value] of [['username', username], ['phone', phone], ['email', email]]) {
    if (!value) continue;
    const clash = await prisma.user.findFirst({ where: { deletedAt: null, [field]: value }, select: { id: true } });
    if (clash) throw new Error(`This ${field} already exists on another user.`);
  }

  const slug = await uniqueTenantSlug(businessName, ALL_MODULES);

  if (dryRun) {
    console.log(`[dry run] would create tenant "${businessName}" slug=${slug} domain=${customDomain}, owner ${username}`);
    return;
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: businessName, slug, status: 'active', customDomain },
    });

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: branchName,
        code: branchCode,
        status: 'active',
        enabledModules: JSON.stringify(ALL_MODULES),
      },
    });

    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'lifetime',
        status: 'active',
        maxActiveLoans: 999999,
        maxAgents: 999,
        maxBranches: 999,
        enabledModules: JSON.stringify(ALL_MODULES),
        selectedAddons: JSON.stringify([]),
        // Add-ons stay off on a fresh claim — enable per tenant in /admin/billing.
        whatsappSmsEnabled: false,
        kycEnabled: false,
        gpsTrackingEnabled: false,
        premiumAccountingEnabled: false,
        bureauEnabled: false,
        basePlanPrice: 0,
        modulesPrice: 0,
        addonsPrice: 0,
        totalMonthlyPrice: 0,
        trialEndsAt: null,
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: ownerName,
        phone,
        email,
        username,
        passwordHash,
        role: 'superadmin',
        appType: ALL_MODULES[0],
        status: 'active',
        canCreateLoan: true,
      },
    });

    await tx.branch.update({ where: { id: branch.id }, data: { superadminId: user.id } });
    await tx.superadminBranch.create({
      data: { superadminId: user.id, branchId: branch.id, assignedById: user.id },
    });

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
      { key: 'loan_code_counter', value: '0', group: 'general' },
    ];
    await tx.appSetting.createMany({
      data: defaultSettings.map((s) => ({ tenantId: tenant.id, ...s })),
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: 'create',
        entityType: 'tenant',
        entityId: tenant.id,
        newValue: JSON.stringify({ name: businessName, slug, customDomain, owner: ownerName, provisionedBy: 'script' }),
      },
    });

    return { tenant, branch, user };
  });

  console.log(`✅ Tenant  : ${result.tenant.name}  slug=${result.tenant.slug}  id=${result.tenant.id}`);
  console.log(`✅ Domain  : ${customDomain}  (self-registration on this host is now locked)`);
  console.log(`✅ Plan    : lifetime — all ${ALL_MODULES.length} modules, add-ons off`);
  console.log(`✅ Branch  : ${result.branch.name} (${result.branch.code})  id=${result.branch.id}`);
  console.log(`✅ Owner   : ${result.user.username}  role=superadmin  status=active  id=${result.user.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
