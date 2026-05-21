#!/usr/bin/env node

/**
 * Fix Script: Enable Chit Funds module on branches
 * Run this if branches are missing the Chit Funds module
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function enableChitFundsOnBranches() {
  try {
    console.log('🔧 Enable Chit Funds Module on Branches\n');

    // Find branches without Chit Funds
    const branches = await prisma.branch.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, enabledModules: true },
      orderBy: { name: 'asc' },
    });

    const branchesWithoutChitFunds = branches.filter(b => {
      const modules = JSON.parse(b.enabledModules || '[]');
      return !modules.includes('chitfunds');
    });

    if (branchesWithoutChitFunds.length === 0) {
      console.log('✅ All active branches already have Chit Funds enabled!\n');
      rl.close();
      return;
    }

    console.log(`Found ${branchesWithoutChitFunds.length} branch(es) missing Chit Funds:\n`);
    branchesWithoutChitFunds.forEach((b, i) => {
      const modules = JSON.parse(b.enabledModules || '[]');
      console.log(`${i + 1}. ${b.name}`);
      console.log(`   Current modules: ${modules.join(', ') || 'NONE'}`);
    });

    console.log();
    const enable = await question('Enable Chit Funds on all these branches? (y/n): ');

    if (enable.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return;
    }

    let updated = 0;
    for (const branch of branchesWithoutChitFunds) {
      const currentModules = JSON.parse(branch.enabledModules || '[]');
      const newModules = [...currentModules, 'chitfunds'];

      await prisma.branch.update({
        where: { id: branch.id },
        data: { enabledModules: JSON.stringify(newModules) },
      });

      console.log(`✅ ${branch.name} → Added Chit Funds`);
      updated++;
    }

    console.log(`\n✅ Updated ${updated} branch(es) with Chit Funds module!\n`);

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

enableChitFundsOnBranches();
