const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, enabledModules: true, superadminId: true, status: true }
  });
  console.log(JSON.stringify(branches, null, 2));

  const users = await prisma.user.findMany({
    where: { role: 'superadmin' },
    select: { id: true, username: true, role: true }
  });
  console.log("Superadmins:", JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
