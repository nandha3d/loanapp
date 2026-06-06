const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('--- Tenants ---');
    console.log(tenants);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        tenantId: true,
        googleId: true,
      }
    });
    console.log('--- Latest Users ---');
    console.log(users);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
