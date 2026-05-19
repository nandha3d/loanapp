const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const superadmin = await prisma.user.findFirst({ where: { username: 'superadmin' } });
  if (!superadmin) {
    console.log('No superadmin found');
    return;
  }
  
  const res = await prisma.branch.updateMany({
    data: { superadminId: superadmin.id }
  });
  
  console.log(`✅ Assigned superadmin to ${res.count} branches`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
