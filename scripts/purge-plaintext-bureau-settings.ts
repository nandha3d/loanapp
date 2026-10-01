import prisma from '../lib/db';

/**
 * SEC-09: Purge plaintext bureau keys from AppSetting.
 *
 * Credit bureau credentials and configurations must be configured via
 * encrypted BureauCredential rows on the web dashboard. The legacy keys
 * (bureau_member_id, bureau_api_key, bureau_pulls_enabled) stored credentials
 * in plaintext in the AppSetting table and are obsolete.
 *
 * Usage:
 *   npx tsx scripts/purge-plaintext-bureau-settings.ts            # Dry run (default)
 *   npx tsx scripts/purge-plaintext-bureau-settings.ts --execute # Actually purge
 */

export const TARGET_KEYS = [
  'bureau_member_id',
  'bureau_api_key',
  'bureau_pulls_enabled',
];

export async function purgePlaintextBureauSettings(execute: boolean = false) {
  const matching = await prisma.appSetting.findMany({
    where: {
      key: { in: TARGET_KEYS },
    },
    select: {
      id: true,
      tenantId: true,
      key: true,
    },
  });

  console.log(`Found ${matching.length} plaintext bureau setting rows in AppSetting.`);
  for (const row of matching) {
    console.log(`  - Tenant: ${row.tenantId}, Key: ${row.key} (ID: ${row.id})`);
  }

  if (!execute) {
    console.log('\n[DRY RUN] No records were deleted. Run with --execute to permanently delete.');
    return { count: matching.length, executed: false };
  }

  const result = await prisma.appSetting.deleteMany({
    where: {
      key: { in: TARGET_KEYS },
    },
  });

  console.log(`\n[EXECUTED] Successfully purged ${result.count} plaintext bureau setting rows.`);
  return { count: result.count, executed: true };
}

if (require.main === module || process.argv[1]?.includes('purge-plaintext-bureau-settings')) {
  const execute = process.argv.includes('--execute') || process.argv.includes('--force');
  purgePlaintextBureauSettings(execute)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error during bureau settings purge:', err);
      process.exit(1);
    });
}
