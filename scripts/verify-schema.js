const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

async function verify() {
  try {
    const [sa, um, mr] = await Promise.all([
      p.superadminBranch.count(),
      p.userModule.count(),
      p.moduleRequest.count(),
    ]);
    console.log('✓ superadminBranch table exists, count:', sa);
    console.log('✓ userModule table exists, count:', um);
    console.log('✓ moduleRequest table exists, count:', mr);
    
    // Check canCreateLoan column
    const user = await p.user.findFirst({ select: { canCreateLoan: true } });
    if (user !== null) {
      console.log('✓ canCreateLoan column exists on users table');
    } else {
      console.log('⚠ No users in database, but canCreateLoan column schema is present');
    }
    console.log('\n✓ All new tables and columns created successfully!');
  } catch (e) {
    console.error('✗ Error:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

verify();
