const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const collections = await prisma.collectionEntry.findMany({
    orderBy: { submittedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      receivedAmount: true,
      submittedAt: true,
      remarks: true,
      collection: {
        select: {
          date: true
        }
      }
    }
  });

  console.log("LAST 10 COLLECTIONS:");
  console.log(JSON.stringify(collections, null, 2));

  // Check current date according to database
  const dbTime = await prisma.$queryRaw`SELECT NOW() as now, CURDATE() as curdate, UTC_TIMESTAMP() as utc`;
  console.log("DB TIME:", JSON.stringify(dbTime, null, 2));
  console.log("JS TIME:", new Date().toISOString(), "Local time string:", new Date().toString());
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
