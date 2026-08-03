/**
 * Create a user in an existing tenant, optionally cloning another user's
 * credentials (so "the same login" works without anyone knowing the password —
 * bcrypt hashes cannot be reversed, but they can be copied).
 *
 * Module access for admin/agent is UserBranchModule ∩ Branch.enabledModules
 * (lib/branch.ts:75-98); UserModule rows are written too because /admin/users
 * renders them (app/admin/actions.ts:402-416).
 *
 * Uniqueness note: the DB constrains username/phone/email per tenant
 * (@@unique([tenantId, ...])), but the app enforces them GLOBALLY via
 * lib/userUniqueness.ts. This script only enforces the per-tenant rule, so a
 * duplicate username across tenants is possible — see ALLOW_GLOBAL_DUPLICATE.
 *
 * Usage (PowerShell):
 *   $env:TENANT='loan.samuraibuiness.in'; $env:USERNAME='sathis'
 *   $env:NAME='Samurai'; $env:PHONE='7373112929'; $env:ROLE='admin'
 *   $env:PASSWORD='...'; $env:BRANCH_CODE='HQ'
 *   $env:MODULES='microlending,autofinance,chitfunds'
 *   node scripts/create-user.js          # add DRY_RUN=1 first
 *
 * Clone credentials from an existing user instead of setting a password:
 *   $env:CLONE_FROM='developer'          # username to copy hash/name/phone from
 *   $env:CLONE_FROM_TENANT='<slug|domain|id>'   # defaults to searching all tenants
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function required(key) {
  const value = (process.env[key] || '').trim();
  if (!value) throw new Error(`Set ${key} before running this script.`);
  return value;
}

async function resolveTenant(ref) {
  const byId = await prisma.tenant.findUnique({ where: { id: ref } }).catch(() => null);
  if (byId) return byId;
  const bySlug = await prisma.tenant.findUnique({ where: { slug: ref } }).catch(() => null);
  if (bySlug) return bySlug;
  const byDomain = await prisma.tenant.findUnique({ where: { customDomain: ref.toLowerCase() } }).catch(() => null);
  if (byDomain) return byDomain;
  throw new Error(`No tenant matches "${ref}".`);
}

async function main() {
  const tenant = await resolveTenant(required('TENANT'));
  const username = required('USERNAME');
  const role = (process.env.ROLE || 'agent').trim().toLowerCase();
  const dryRun = process.env.DRY_RUN === '1';
  const allowGlobalDup = process.env.ALLOW_GLOBAL_DUPLICATE === '1';
  const cloneFrom = (process.env.CLONE_FROM || '').trim() || null;

  const VALID_ROLES = ['developer', 'superadmin', 'admin', 'agent'];
  if (!VALID_ROLES.includes(role)) throw new Error(`ROLE must be one of: ${VALID_ROLES.join(', ')}`);

  // Source user to clone credentials from.
  let source = null;
  if (cloneFrom) {
    const where = { username: cloneFrom, deletedAt: null };
    if (process.env.CLONE_FROM_TENANT) {
      where.tenantId = (await resolveTenant(process.env.CLONE_FROM_TENANT)).id;
    }
    const matches = await prisma.user.findMany({
      where,
      select: { id: true, username: true, name: true, phone: true, email: true, passwordHash: true, role: true, tenantId: true },
    });
    if (matches.length === 0) throw new Error(`CLONE_FROM user "${cloneFrom}" not found.`);
    if (matches.length > 1) throw new Error(`CLONE_FROM "${cloneFrom}" is ambiguous (${matches.length} matches) — set CLONE_FROM_TENANT.`);
    source = matches[0];
    if (!source.passwordHash) throw new Error(`Source user "${cloneFrom}" has no password set — nothing to clone.`);
  }

  const name = (process.env.NAME || '').trim() || source?.name;
  const phone = (process.env.PHONE || '').trim() || source?.phone;
  const email = (process.env.EMAIL || '').trim().toLowerCase() || source?.email || null;
  const password = process.env.PASSWORD || null;

  if (!name) throw new Error('Set NAME (or CLONE_FROM).');
  if (!phone) throw new Error('Set PHONE (or CLONE_FROM).');
  if (!password && !source) throw new Error('Set PASSWORD, or CLONE_FROM to copy an existing hash.');

  // Per-tenant constraints (@@unique([tenantId, username|phone|email])).
  for (const [field, value] of [['username', username], ['phone', phone], ['email', email]]) {
    if (!value) continue;
    const clash = await prisma.user.findFirst({
      where: { tenantId: tenant.id, [field]: value },
      select: { username: true },
    });
    if (clash) throw new Error(`${field} "${value}" already exists in this tenant (user "${clash.username}").`);
  }

  // The app expects these to be globally unique; warn loudly if they are not.
  const globalDups = [];
  for (const [field, value] of [['username', username], ['phone', phone], ['email', email]]) {
    if (!value) continue;
    const hit = await prisma.user.findFirst({
      where: { deletedAt: null, [field]: value, tenantId: { not: tenant.id } },
      select: { username: true, tenantId: true },
    });
    if (hit) globalDups.push(`${field} "${value}" also exists in tenant ${hit.tenantId}`);
  }
  if (globalDups.length > 0 && !allowGlobalDup) {
    throw new Error(
      `Would break the app's global uniqueness (lib/userUniqueness.ts):\n  - ${globalDups.join('\n  - ')}\n` +
      `Re-run with ALLOW_GLOBAL_DUPLICATE=1 if that is intended.`
    );
  }

  // Branch + modules for roles that operate inside one branch.
  let branch = null;
  let modules = [];
  if (role === 'admin' || role === 'agent') {
    const branchCode = required('BRANCH_CODE');
    branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, code: branchCode } });
    if (!branch) throw new Error(`Branch code "${branchCode}" not found in tenant "${tenant.name}".`);

    const branchModules = JSON.parse(branch.enabledModules || '[]');
    modules = process.env.MODULES
      ? process.env.MODULES.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean)
      : branchModules;
    const missing = modules.filter((m) => !branchModules.includes(m));
    if (missing.length > 0) {
      throw new Error(`Branch "${branch.name}" does not have these modules enabled: ${missing.join(', ')}.`);
    }
  }

  console.log(`Tenant  : ${tenant.name}${tenant.customDomain ? ` @ ${tenant.customDomain}` : ''}`);
  console.log(`User    : ${username} (${name}) role=${role} phone=${phone} email=${email || '(none)'}`);
  console.log(`Password: ${password ? 'explicit' : `cloned from "${source.username}" (tenant ${source.tenantId})`}`);
  if (branch) console.log(`Branch  : ${branch.name} [${branch.code}] modules=${modules.join(', ')}`);
  if (globalDups.length > 0) console.log(`⚠ global duplicate allowed: ${globalDups.join('; ')}`);
  if (password && password.length < 8) console.log(`⚠ password is only ${password.length} characters — weak.`);

  if (dryRun) {
    console.log('\n[dry run] nothing written.');
    return;
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : source.passwordHash;

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch ? branch.id : null,
        name,
        phone,
        email,
        username,
        passwordHash,
        role,
        appType: modules[0] || 'microlending',
        status: 'active',
        canCreateLoan: role !== 'agent',
      },
    });

    if (role === 'admin' || role === 'agent') {
      await tx.userBranchModule.create({
        data: { userId: u.id, branchId: branch.id, enabledModules: JSON.stringify(modules) },
      });
      for (const m of modules) {
        await tx.userModule.create({ data: { userId: u.id, appType: m, assignedById: u.id } });
      }
    }

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: u.id,
        action: 'create',
        entityType: 'user',
        entityId: u.id,
        newValue: JSON.stringify({ username, role, branch: branch?.code || null, modules, by: 'script' }),
      },
    });

    return u;
  });

  // Prove the credential actually works the way lib/auth.ts will check it.
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (password) {
    const ok = await bcrypt.compare(password, stored.passwordHash);
    console.log(`\n✅ Created ${username} (id=${user.id}) — password verifies: ${ok}`);
    if (!ok) process.exit(1);
  } else {
    console.log(`\n✅ Created ${username} (id=${user.id}) — hash matches source: ${stored.passwordHash === source.passwordHash}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
