const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branchId = 'cmp1cxext0002m5ls50zh8t71'; // Head Office

  // Fix customers with null branchId
  const fixedCustomers = await prisma.customer.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Fixed ${fixedCustomers.count} customers with null branchId`);

  // Fix loans with null branchId  
  const fixedLoans = await prisma.loan.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Fixed ${fixedLoans.count} loans with null branchId`);

  console.log('Done! All records now have branchId set.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
