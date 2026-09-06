/**
 * Add a branch to an existing tenant and give it a superadmin owner.
 *
 * Mirrors createBranch (app/admin/actions.ts:459) — including the maxBranches
 * subscription check and inheriting the subscription's enabledModules — and
 * additionally writes the SuperadminBranch join row that the admin UI creates
 * separately when assigning branches (app/admin/actions.ts:375+).
 *
 * Note on what actually grants access: a superadmin's branches come from
 * Branch.superadmin_id (lib/branch.ts:118 getSuperadminBranches). The
 * SuperadminBranch table is only read for display on /admin/users, but it is
 * written here so both stay consistent.
 *
 * Usage (PowerShell):
 *   $env:TENANT='loan.samuraibuiness.in'   # slug, customDomain, or tenant id
 *   $env:BRANCH_NAME='Erode_Manoj'; $env:BRANCH_CODE='ERODE_MANOJ'
 *   $env:OWNER_USERNAME='Mj1996'
 *   node scripts/add-branch.js             # add DRY_RUN=1 first
 *
 * Optional: BRANCH_PHONE, MODULES (defaults to the tenant subscription's).
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function required(key) {
  const value = (process.env[key] || '').trim();
  if (!value) throw new Error(`Set ${key} before running this script.`);
  return value;
}

function parseJsonList(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function resolveTenant(ref) {
  const byId = await prisma.tenant.findUnique({ where: { id: ref } }).catch(() => null);
  if (byId) return byId;
  const bySlug = await prisma.tenant.findUnique({ where: { slug: ref } }).catch(() => null);
  if (bySlug) return bySlug;
  const byDomain = await prisma.tenant.findUnique({ where: { customDomain: ref.toLowerCase() } }).catch(() => null);
  if (byDomain) return byDomain;
  throw new Error(`No tenant matches "${ref}" (tried id, slug, customDomain).`);
}

async function main() {
  const tenantRef = required('TENANT');
  const branchName = required('BRANCH_NAME');
  const branchCode = required('BRANCH_CODE');
  const ownerUsername = required('OWNER_USERNAME');
  const branchPhone = (process.env.BRANCH_PHONE || '').trim() || null;
  const dryRun = process.env.DRY_RUN === '1';

  const tenant = await resolveTenant(tenantRef);

  const owner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, username: ownerUsername, deletedAt: null },
    select: { id: true, username: true, name: true, role: true },
  });
  if (!owner) throw new Error(`User "${ownerUsername}" not found in tenant "${tenant.name}".`);
  if (owner.role !== 'superadmin') {
    throw new Error(`Owner "${ownerUsername}" is role="${owner.role}" — a branch owner must be a superadmin.`);
  }

  const existing = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, code: branchCode },
    select: { id: true, name: true },
  });
  if (existing) throw new Error(`Branch code "${branchCode}" already exists in this tenant ("${existing.name}").`);

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: tenant.id },
    select: { enabledModules: true, maxBranches: true },
  });
  const subModules = parseJsonList(sub?.enabledModules);
  const modules = process.env.MODULES
    ? process.env.MODULES.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean)
    : subModules;

  const outside = subModules.length > 0 ? modules.filter((m) => !subModules.includes(m)) : [];
  if (outside.length > 0) {
    throw new Error(`Modules not in the tenant subscription: ${outside.join(', ')}. Enable them on the subscription first.`);
  }

  // Same limit check createBranch performs (0 = unlimited).
  const activeCount = await prisma.branch.count({ where: { tenantId: tenant.id, status: 'active' } });
  if (sub && sub.maxBranches > 0 && activeCount >= sub.maxBranches) {
    throw new Error(`Branch limit reached (${sub.maxBranches}).`);
  }

  console.log(`Tenant : ${tenant.name} (${tenant.slug})${tenant.customDomain ? ` @ ${tenant.customDomain}` : ''}`);
  console.log(`Branch : ${branchName} (${branchCode})  modules=${modules.join(', ')}`);
  console.log(`Owner  : ${owner.username} (${owner.name}) — superadmin`);
  console.log(`Existing active branches: ${activeCount}${sub?.maxBranches ? ` / ${sub.maxBranches}` : ''}`);

  if (dryRun) {
    console.log('\n[dry run] nothing written.');
    return;
  }

  const branch = await prisma.$transaction(async (tx) => {
    const b = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        superadminId: owner.id,
        name: branchName,
        code: branchCode,
        phone: branchPhone,
        status: 'active',
        enabledModules: JSON.stringify(modules),
      },
    });

    await tx.superadminBranch.upsert({
      where: { superadminId_branchId: { superadminId: owner.id, branchId: b.id } },
      update: {},
      create: { superadminId: owner.id, branchId: b.id, assignedById: owner.id },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        action: 'create',
        entityType: 'branch',
        entityId: b.id,
        newValue: JSON.stringify({ name: branchName, code: branchCode, owner: owner.username, modules, by: 'script' }),
      },
    });

    return b;
  });

  // Verify from a fresh read.
  const owned = await prisma.branch.findMany({
    where: { tenantId: tenant.id, superadminId: owner.id, status: 'active' },
    select: { name: true, code: true, enabledModules: true },
    orderBy: { name: 'asc' },
  });
  console.log(`\n✅ Created branch ${branch.name} (${branch.code}) id=${branch.id}`);
  console.log(`${owner.username} now owns: ${owned.map((b) => `${b.name}[${b.code}]`).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
