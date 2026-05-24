const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const agents = await prisma.user.findMany({
      where: { role: 'agent', status: 'active' },
      select: { id: true, name: true, phone: true },
    });
    console.log("Agents:", agents.length);

    if (agents.length === 0) return;

    const pings = await prisma.agentLocationPing.findMany({
      where: { agentId: { in: agents.map((a) => a.id) } },
      orderBy: { capturedAt: 'desc' },
    });
    console.log("Pings:", pings.length);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
