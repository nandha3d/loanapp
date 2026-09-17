/**
 * Turn a per-tenant feature flag on or off.
 *
 * Flags live in the AppSetting key/value table (lib/tenant.ts getSetting/setSetting)
 * rather than on TenantSubscription, which is reserved for billable add-ons. Values
 * are '1' (on) / '0' (off); lib/features.ts reads them.
 *
 * Usage (PowerShell):
 *   $env:TENANT='loan.samuraibuiness.in'      # slug, customDomain, or tenant id
 *   $env:KEY='interest_only_enabled'; $env:VALUE='1'
 *   node scripts/set-tenant-flag.js           # add DRY_RUN=1 first
 *
 * Optional: GROUP (AppSetting.group, defaults to 'features').
 *
 * The running app caches tenant settings in-process (lib/cache/tenantCache.ts) and
 * only invalidates on writes made through the app itself, so restart the app (or
 * wait for the cache TTL) after running this.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Keys this script is allowed to write. Guards against a typo silently creating a
// dead setting that never gets read.
const KNOWN_FLAGS = ['interest_only_enabled'];

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
  throw new Error(`No tenant matches "${ref}" (tried id, slug, customDomain).`);
}

async function main() {
  const tenantRef = required('TENANT');
  const key = required('KEY');
  const value = required('VALUE');
  const group = (process.env.GROUP || 'features').trim();
  const dryRun = process.env.DRY_RUN === '1';

  if (!KNOWN_FLAGS.includes(key)) {
    throw new Error(`Unknown flag "${key}". Known flags: ${KNOWN_FLAGS.join(', ')}.`);
  }
  if (!['0', '1'].includes(value)) {
    throw new Error(`VALUE must be '1' (on) or '0' (off), got "${value}".`);
  }

  const tenant = await resolveTenant(tenantRef);
  const existing = await prisma.appSetting.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key } },
    select: { value: true },
  });

  console.log(`Tenant : ${tenant.name} (${tenant.slug}${tenant.customDomain ? ` — ${tenant.customDomain}` : ''})`);
  console.log(`Flag   : ${key}`);
  console.log(`Change : ${existing ? existing.value : '(unset)'} → ${value}`);

  if (dryRun) {
    console.log('\nDRY_RUN=1 — nothing written.');
    return;
  }

  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key } },
    update: { value, group },
    create: { tenantId: tenant.id, key, value, group },
  });

  console.log('\n✅ Written. Restart the app so the tenant settings cache picks it up.');
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
