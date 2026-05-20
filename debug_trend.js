const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function startOfDay(date = new Date()) {
  const v = new Date(date);
  v.setHours(0, 0, 0, 0);
  return v;
}

async function main() {
  const today = startOfDay();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);

  console.log("TODAY:", today.toISOString(), today.toString());
  console.log("TOMORROW:", tomorrow.toISOString());
  console.log("WEEKSTART:", weekStart.toISOString());

  const weekCollections = await prisma.collectionEntry.findMany({
    where: { submittedAt: { gte: weekStart, lt: tomorrow } },
    select: { receivedAmount: true, submittedAt: true }
  });

  console.log(`\nFound ${weekCollections.length} collections for the week.`);

  const trend7d = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = d.toISOString().slice(0, 10);
    const cols = weekCollections.filter(c => c.submittedAt.toISOString().slice(0, 10) === dk);
    const sumCollected = cols.reduce((s, r) => s + Number(r.receivedAmount), 0);
    return {
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      dateKey: dk,
      collected: sumCollected,
      collectionsCount: cols.length,
      collectionDetails: cols.map(c => ({ amount: c.receivedAmount, time: c.submittedAt }))
    };
  });

  console.log("\nTREND DAYS CALCULATION:");
  console.log(JSON.stringify(trend7d, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
