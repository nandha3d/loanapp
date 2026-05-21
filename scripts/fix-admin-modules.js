#!/usr/bin/env node

/**
 * Fix Script: Enable missing modules on branch and update admin users
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixBranchModules() {
  try {
    console.log('🔧 Fix: Enable Modules on Erode Branch\n');

    // Get the Erode branch
    const branch = await prisma.branch.findFirst({
      where: { name: 'Erode' },
      select: { id: true, name: true, enabledModules: true },
    });

    if (!branch) {
      console.log('❌ Erode branch not found');
      return;
    }

    const currentModules = JSON.parse(branch.enabledModules || '[]');
    console.log(`📍 Erode Branch`);
    console.log(`   Current modules: ${currentModules.join(', ') || 'NONE'}\n`);

    // Modules that admin has access to but branch doesn't
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin', role: 'admin' },
      include: { userBranchModules: true },
    });

    const adminModules = adminUser?.userBranchModules?.[0]
      ? JSON.parse(adminUser.userBranchModules[0].enabledModules || '[]')
      : [];

    const missingModules = adminModules.filter(m => !currentModules.includes(m));
    
    if (missingModules.length === 0) {
      console.log('✅ Branch has all required modules.\n');
    } else {
      console.log(`Found ${missingModules.length} module(s) on admin user but not on branch:`);
      missingModules.forEach(m => console.log(`  - ${m}`));
      console.log();

      // Enable all modules on the branch
      const updatedModules = [...new Set([...currentModules, ...missingModules])];
      await prisma.branch.update({
        where: { id: branch.id },
        data: { enabledModules: JSON.stringify(updatedModules) },
      });
      console.log(`✅ Updated Erode branch with modules: ${updatedModules.join(', ')}\n`);
    }

    // Update admin2's modules to include chitfunds if admin has it
    const admin2 = await prisma.user.findFirst({
      where: { username: 'admin2', role: 'admin' },
      include: { userBranchModules: true },
    });

    if (admin2) {
      const admin2Modules = admin2.userBranchModules?.[0]
        ? JSON.parse(admin2.userBranchModules[0].enabledModules || '[]')
        : [];

      const shouldAdd = adminModules.filter(m => !admin2Modules.includes(m));
      
      if (shouldAdd.length > 0) {
        console.log(`Adding to admin2: ${shouldAdd.join(', ')}`);
        const updatedAdmin2Modules = [...new Set([...admin2Modules, ...shouldAdd])];
        
        await prisma.userBranchModule.update({
          where: {
            userId_branchId: {
              userId: admin2.id,
              branchId: branch.id,
            },
          },
          data: { enabledModules: JSON.stringify(updatedAdmin2Modules) },
        });
        console.log(`✅ Updated admin2 modules: ${updatedAdmin2Modules.join(', ')}\n`);
      }
    }

    console.log('🎉 Done! Branch and admin2 are now synchronized.\n');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixBranchModules();
