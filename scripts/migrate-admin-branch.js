#!/usr/bin/env node

/**
 * Migration Script: Assign branchId to existing admin users without branch assignment
 * 
 * Problem: Previously, createUser() didn't assign branchId to admin users,
 * causing them to have no accessible modules and fall back to loantrack only.
 * 
 * Solution: This script finds all admin users without branchId and:
 * 1. Assigns them to the first active branch in their tenant
 * 2. Creates UserBranchModule entries with the branch's enabled modules
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateAdminBranches() {
  try {
    console.log('🔍 Scanning for admin users without branchId...\n');

    // Find all admin users without a branchId
    const adminsWithoutBranch = await prisma.user.findMany({
      where: {
        role: 'admin',
        branchId: null,
      },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (adminsWithoutBranch.length === 0) {
      console.log('✅ No admin users without branchId found. Migration complete!');
      return;
    }

    console.log(`Found ${adminsWithoutBranch.length} admin user(s) without branchId:\n`);
    adminsWithoutBranch.forEach((user) => {
      console.log(`  - ${user.name} (${user.username}) — Tenant: ${user.tenant?.name || user.tenantId}`);
    });
    console.log('\n');

    let updated = 0;
    let failed = 0;

    // Process each admin user
    for (const adminUser of adminsWithoutBranch) {
      try {
        // Find the first active branch for this tenant
        const firstBranch = await prisma.branch.findFirst({
          where: {
            tenantId: adminUser.tenantId,
            status: 'active',
          },
          select: { id: true, name: true, enabledModules: true },
          orderBy: { name: 'asc' },
        });

        if (!firstBranch) {
          console.log(
            `⚠️  ${adminUser.name} (${adminUser.username}): No active branch found for tenant ${adminUser.tenantId}`
          );
          failed++;
          continue;
        }

        // Assign branchId to the admin user
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { branchId: firstBranch.id },
        });

        // Create UserBranchModule entry with the branch's enabled modules
        const branchModules = JSON.parse(firstBranch.enabledModules || '[]');
        await prisma.userBranchModule.upsert({
          where: {
            userId_branchId: {
              userId: adminUser.id,
              branchId: firstBranch.id,
            },
          },
          create: {
            userId: adminUser.id,
            branchId: firstBranch.id,
            enabledModules: JSON.stringify(branchModules),
          },
          update: {
            enabledModules: JSON.stringify(branchModules),
          },
        });

        console.log(
          `✅ ${adminUser.name} (${adminUser.username}) → Assigned to branch "${firstBranch.name}"`
        );
        updated++;
      } catch (error) {
        console.error(
          `❌ ${adminUser.name} (${adminUser.username}): ${error.message}`
        );
        failed++;
      }
    }

    console.log(`\n📊 Migration Results:`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📝 Total: ${adminsWithoutBranch.length}`);

    if (failed === 0) {
      console.log('\n🎉 All admin users have been successfully migrated!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAdminBranches();
