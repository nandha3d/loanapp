/**
 * Reset one user's password. Hashes with bcrypt cost 12, matching the rest of
 * the codebase (lib/auth.ts compares against this hash).
 *
 * Existing sessions are NOT invalidated — the session is a 30-day JWT and the
 * jwt callback only re-reads the DB when the token has no role
 * (lib/auth.ts:442). A password reset alone does not sign anyone out.
 *
 * Usage (PowerShell):
 *   $env:TENANT='loan.samuraibuiness.in'; $env:USERNAME='Mj1996'
 *   $env:NEW_PASSWORD='...'
 *   node scripts/reset-password.js
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
  const newPassword = required('NEW_PASSWORD');
  if (newPassword.length < 8) throw new Error('NEW_PASSWORD must be at least 8 characters.');

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, username, deletedAt: null },
    select: { id: true, username: true, name: true, role: true, status: true },
  });
  if (!user) throw new Error(`User "${username}" not found in tenant "${tenant.name}".`);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  // Prove the new password actually verifies against what was stored.
  const after = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const ok = await bcrypt.compare(newPassword, after.passwordHash);

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      newValue: JSON.stringify({ username: user.username, passwordReset: true, by: 'script' }),
    },
  });

  console.log(`✅ ${user.username} (${user.name}) role=${user.role} status=${user.status}`);
  console.log(`   password updated — verification: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exit(1);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
