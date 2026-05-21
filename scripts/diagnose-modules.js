#!/usr/bin/env node

/**
 * Diagnostic: Check branch module configuration
 * Run this to verify if branches have the correct modules enabled
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function diagnoseBranches() {
  try {
    console.log('🔍 Branch Module Configuration Diagnostic\n');

    // Get all branches with their modules
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, code: true, status: true, enabledModules: true, tenantId: true },
      orderBy: { name: 'asc' },
    });

    if (branches.length === 0) {
      console.log('No branches found.');
      return;
    }

    console.log(`Found ${branches.length} branch(es):\n`);

    for (const branch of branches) {
      const enabledModules = JSON.parse(branch.enabledModules || '[]');
      console.log(`📍 ${branch.name} (${branch.code || 'no code'})`);
      console.log(`   ID: ${branch.id}`);
      console.log(`   Status: ${branch.status}`);
      console.log(`   Modules: ${enabledModules.length > 0 ? enabledModules.join(', ') : 'NONE'}`);
      
      if (enabledModules.length === 0) {
        console.log(`   ⚠️  WARNING: This branch has NO modules enabled!`);
      }
      
      // Check if it has chitfunds
      if (!enabledModules.includes('chitfunds')) {
        console.log(`   ❌ MISSING: Chit Funds module not enabled on this branch`);
      } else {
        console.log(`   ✅ Chit Funds module IS enabled`);
      }
      
      console.log();
    }

    // Check admin users and their module access
    console.log('\n👤 Admin Users & Module Access:\n');
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      include: { 
        userBranchModules: { select: { branchId: true, enabledModules: true } },
        branch: { select: { id: true, name: true, enabledModules: true } }
      },
      orderBy: { name: 'asc' },
    });

    for (const admin of admins) {
      console.log(`👤 ${admin.name} (${admin.username})`);
      console.log(`   Branch ID: ${admin.branchId || 'NONE'}`);
      console.log(`   Branch Name: ${admin.branch?.name || 'NOT ASSIGNED'}`);
      
      if (admin.userBranchModules.length > 0) {
        for (const ubm of admin.userBranchModules) {
          const modules = JSON.parse(ubm.enabledModules || '[]');
          console.log(`   ✅ UserBranchModule for branch ${ubm.branchId}: ${modules.join(', ') || 'NONE'}`);
          
          if (admin.branch && ubm.branchId === admin.branchId) {
            if (!modules.includes('chitfunds')) {
              console.log(`   ⚠️  Chit Funds not in user's module list`);
            }
          }
        }
      } else {
        console.log(`   ℹ️  No UserBranchModule overrides (will inherit branch defaults)`);
      }
      console.log();
    }

    console.log('\n📋 Summary:');
    console.log('- If branch has Chit Funds enabled, admin should have access');
    console.log('- If admin is missing UserBranchModule, they inherit branch defaults');
    console.log('- If admin has UserBranchModule but Chit Funds is missing, enable it');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseBranches();
