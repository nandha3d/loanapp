/**
 * Hand a tenant's ownership from one user to another: demote the current
 * superadmin to a branch admin scoped to specific modules, and install a new
 * superadmin in their place.
 *
 * Ownership is NOT just User.role. A superadmin owns branches via
 * Branch.superadmin_id (lib/branch.ts:getSuperadminBranches / getActiveBranchId)
 * plus SuperadminBranch join rows, so a bare role change would orphan every
 * branch — the demoted user keeps pointing at them while the new owner sees
 * none. This transfers both, in one transaction.
 *
 * An admin's visible modules come from UserBranchModule ∩ Branch.enabledModules
 * (lib/branch.ts:75-98). UserModule rows are also written because /admin/users
 * displays them (app/admin/actions.ts:402-416), but they do not gate access.
 *
 * Usage (PowerShell):
 *   $env:TENANT='app.animazon.in'          # slug, customDomain, or tenant id
 *   $env:DEMOTE_USERNAME='satish'
 *   $env:MODULES='microlending,autofinance,chitfunds'
 *   $env:NEW_USERNAME='manoj'; $env:NEW_NAME='Manoj'
 *   $env:NEW_PHONE='9998887701'; $env:NEW_PASSWORD='...'
 *   node scripts/swap-superadmin.js            # add DRY_RUN=1 first
 *
 * Optional: NEW_EMAIL, ENABLE_BRANCH_MODULES=1 (add missing modules to the
 * demoted user's branch instead of aborting).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_MODULES = ['microlending', 'autofinance', 'chitfunds'];

function required(key) {
  const value = (process.env[key] || '').trim();
  if (!value) throw new Error(`Set ${key} before running this script.`);
  return value;
}

function parseModules(raw) {
  if (!raw) return DEFAULT_MODULES;
  return raw.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
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
  const demoteUsername = required('DEMOTE_USERNAME').toLowerCase();
  const newUsername = required('NEW_USERNAME').toLowerCase();
  const newName = (process.env.NEW_NAME || '').trim() || null;
  const newPhone = (process.env.NEW_PHONE || '').trim() || null;
  const newEmail = (process.env.NEW_EMAIL || '').trim().toLowerCase() || null;
  const modules = parseModules(process.env.MODULES);
  const dryRun = process.env.DRY_RUN === '1';
  const enableBranchModules = process.env.ENABLE_BRANCH_MODULES === '1';
  const newPassword = process.env.NEW_PASSWORD || null;

  const tenant = await resolveTenant(tenantRef);

  const demote = await prisma.user.findFirst({
    where: { tenantId: tenant.id, username: demoteUsername, deletedAt: null },
    include: { branch: true },
  });
  if (!demote) throw new Error(`User "${demoteUsername}" not found in tenant "${tenant.name}".`);
  if (demote.role !== 'superadmin') {
    throw new Error(`User "${demoteUsername}" is role="${demote.role}", not superadmin — refusing to guess intent.`);
  }

  // Branches this user currently owns — these must move, or they are orphaned.
  const ownedBranches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, superadminId: demote.id },
    select: { id: true, name: true, code: true, enabledModules: true },
  });

  // The branch the demoted user will administer: their own branchId, else the
  // first branch they owned.
  const targetBranch =
    (demote.branchId && (await prisma.branch.findUnique({ where: { id: demote.branchId } }))) ||
    (ownedBranches.length > 0 ? await prisma.branch.findUnique({ where: { id: ownedBranches[0].id } }) : null);
  if (!targetBranch) {
    throw new Error(`No branch to assign "${demoteUsername}" to as admin — a branch admin must have one.`);
  }

  // An admin only ever sees UserBranchModule ∩ branch.enabledModules.
  const branchModules = parseJsonList(targetBranch.enabledModules);
  const missing = modules.filter((m) => !branchModules.includes(m));
  if (missing.length > 0 && !enableBranchModules) {
    throw new Error(
      `Branch "${targetBranch.name}" does not have these modules enabled: ${missing.join(', ')}. ` +
      `Enable them on the branch first, or re-run with ENABLE_BRANCH_MODULES=1.`
    );
  }

  // Subscription is the outer gate — flag anything outside it.
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId: tenant.id } });
  const subModules = parseJsonList(sub?.enabledModules);
  const outsideSub = subModules.length > 0 ? modules.filter((m) => !subModules.includes(m)) : [];

  // Global uniqueness (lib/userUniqueness.ts), unless the target already exists.
  const existingNew = await prisma.user.findFirst({
    where: { tenantId: tenant.id, username: newUsername, deletedAt: null },
  });

  // A brand-new owner needs an identity; an existing one keeps everything not
  // explicitly overridden — never clobber a live account's name/phone/password.
  if (!existingNew) {
    if (!newName) throw new Error('NEW_NAME is required when creating a new superadmin.');
    if (!newPhone) throw new Error('NEW_PHONE is required when creating a new superadmin.');
    if (!dryRun && (!newPassword || newPassword.length < 8)) {
      throw new Error('NEW_PASSWORD (min 8 chars) is required when creating a new superadmin.');
    }
  } else if (newPassword && newPassword.length < 8) {
    throw new Error('NEW_PASSWORD must be at least 8 characters.');
  }
  for (const [field, value] of [['username', newUsername], ['phone', newPhone], ['email', newEmail]]) {
    if (!value) continue;
    const clash = await prisma.user.findFirst({
      where: { deletedAt: null, [field]: value, ...(existingNew ? { id: { not: existingNew.id } } : {}) },
      select: { id: true, username: true, tenantId: true },
    });
    if (clash) throw new Error(`This ${field} ("${value}") already belongs to user "${clash.username}".`);
  }

  console.log(`Tenant       : ${tenant.name} (${tenant.slug})${tenant.customDomain ? ` @ ${tenant.customDomain}` : ''}`);
  console.log(`Demote       : ${demote.username} (${demote.name}) superadmin → admin @ ${targetBranch.name}`);
  console.log(`  modules    : ${modules.join(', ')}`);
  console.log(`  branches moving off them: ${ownedBranches.map((b) => b.name).join(', ') || '(none)'}`);
  if (existingNew) {
    const changes = [
      existingNew.role !== 'superadmin' ? `role ${existingNew.role}→superadmin` : 'role already superadmin',
      newName ? `name→"${newName}"` : null,
      newPhone ? `phone→${newPhone}` : null,
      newEmail ? `email→${newEmail}` : null,
      newPassword ? 'password RESET' : 'password unchanged',
    ].filter(Boolean);
    console.log(`New owner    : ${newUsername} (${existingNew.name}) [EXISTING USER] — ${changes.join(', ')}`);
  } else {
    console.log(`New owner    : ${newUsername} (${newName}) → superadmin [new user]`);
  }
  if (missing.length > 0) console.log(`  ⚠ will enable on branch "${targetBranch.name}": ${missing.join(', ')}`);
  if (outsideSub.length > 0) console.log(`  ⚠ outside the tenant subscription (will stay invisible): ${outsideSub.join(', ')}`);

  if (dryRun) {
    console.log('\n[dry run] nothing written.');
    return;
  }

  const passwordHash = newPassword ? await bcrypt.hash(newPassword, 12) : null;

  await prisma.$transaction(async (tx) => {
    // 1. New superadmin. For an existing account only the role is forced —
    //    identity fields change only when explicitly supplied.
    const owner = existingNew
      ? await tx.user.update({
          where: { id: existingNew.id },
          data: {
            role: 'superadmin',
            status: 'active',
            ...(newName ? { name: newName } : {}),
            ...(newPhone ? { phone: newPhone } : {}),
            ...(newEmail ? { email: newEmail } : {}),
            ...(passwordHash ? { passwordHash } : {}),
          },
        })
      : await tx.user.create({
          data: {
            tenantId: tenant.id,
            branchId: targetBranch.id,
            name: newName,
            phone: newPhone,
            email: newEmail,
            username: newUsername,
            passwordHash,
            role: 'superadmin',
            appType: modules[0],
            status: 'active',
            canCreateLoan: true,
          },
        });

    // 2. Transfer branch ownership. Covers every branch the tenant has, so
    //    nothing is left pointing at the demoted user.
    await tx.branch.updateMany({
      where: { tenantId: tenant.id, superadminId: demote.id },
      data: { superadminId: owner.id },
    });
    await tx.superadminBranch.deleteMany({ where: { superadminId: demote.id } });
    const allBranches = await tx.branch.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
    for (const b of allBranches) {
      await tx.superadminBranch.upsert({
        where: { superadminId_branchId: { superadminId: owner.id, branchId: b.id } },
        update: {},
        create: { superadminId: owner.id, branchId: b.id, assignedById: owner.id },
      });
    }

    // 3. Widen the branch if asked, so the intersection can actually yield the
    //    requested modules.
    if (missing.length > 0) {
      await tx.branch.update({
        where: { id: targetBranch.id },
        data: { enabledModules: JSON.stringify([...branchModules, ...missing]) },
      });
    }

    // 4. Demote.
    await tx.user.update({
      where: { id: demote.id },
      data: { role: 'admin', branchId: targetBranch.id, appType: modules[0], status: 'active' },
    });

    // 5. Module grants for the demoted admin.
    await tx.userBranchModule.upsert({
      where: { userId_branchId: { userId: demote.id, branchId: targetBranch.id } },
      update: { enabledModules: JSON.stringify(modules) },
      create: { userId: demote.id, branchId: targetBranch.id, enabledModules: JSON.stringify(modules) },
    });
    await tx.userBranchModule.deleteMany({ where: { userId: demote.id, branchId: { not: targetBranch.id } } });
    await tx.userModule.deleteMany({ where: { userId: demote.id } });
    for (const m of modules) {
      await tx.userModule.create({ data: { userId: demote.id, appType: m, assignedById: owner.id } });
    }

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        action: 'update',
        entityType: 'user',
        entityId: demote.id,
        oldValue: JSON.stringify({ username: demote.username, role: 'superadmin' }),
        newValue: JSON.stringify({
          username: demote.username, role: 'admin', modules,
          ownershipTransferredTo: owner.username, by: 'script',
        }),
      },
    });
  });

  // Verify from a fresh read rather than trusting the writes.
  const after = await prisma.user.findFirst({
    where: { tenantId: tenant.id, username: demoteUsername },
    include: { userBranchModules: true, userModules: true },
  });
  const ownerAfter = await prisma.user.findFirst({ where: { tenantId: tenant.id, username: newUsername } });
  const ownerBranches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, superadminId: ownerAfter.id },
    select: { name: true },
  });
  const strays = await prisma.branch.count({ where: { tenantId: tenant.id, superadminId: after.id } });

  console.log('\n── after ──');
  console.log(`${after.username}: role=${after.role} branch=${after.branchId} modules=${after.userBranchModules.map((r) => r.enabledModules).join('|')}`);
  console.log(`${ownerAfter.username}: role=${ownerAfter.role} owns=${ownerBranches.map((b) => b.name).join(', ')}`);
  console.log(`branches still owned by the demoted user: ${strays} (must be 0)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
