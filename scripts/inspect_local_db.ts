import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customerCount = await prisma.customer.count();
  const loanCount = await prisma.loan.count();
  const approvalCount = await prisma.approvalRequest.count();
  const accountEntryCount = await prisma.accountEntry.count();
  const userCount = await prisma.user.count();
  const roles = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
  });

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, status: true },
  });
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, code: true, tenantId: true },
  });

  console.log('LOCAL_DB_SUMMARY:', JSON.stringify({
    customerCount,
    loanCount,
    approvalCount,
    accountEntryCount,
    userCount,
    roles,
    tenants,
    branches,
  }));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('DB_ERROR:', err.message);
  process.exit(1);
});
