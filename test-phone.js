const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { phone: '9000000002' } });
  console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
