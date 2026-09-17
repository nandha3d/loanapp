import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Inspecting and cleaning up agent_location_pings indexes...');
  
  // Disable foreign key checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  
  // Find all indexes
  const indexes = await prisma.$queryRawUnsafe<any[]>(
    "SHOW INDEX FROM agent_location_pings"
  );
  
  // Filter indexes that contain 'server_time' in their name
  const legacyIndexNames = Array.from(
    new Set(
      indexes
        .map(idx => idx.Key_name || idx.key_name || '')
        .filter(name => name.includes('server_time'))
    )
  );

  console.log('Found legacy indexes:', legacyIndexNames);

  for (const indexName of legacyIndexNames) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE agent_location_pings DROP INDEX ${indexName};`
      );
      console.log(`✅ Successfully dropped index: ${indexName}`);
    } catch (err: any) {
      console.log(`Failed to drop index ${indexName}:`, err.message);
    }
  }
  
  // Re-enable foreign key checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
