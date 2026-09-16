import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.subscriptionPlanCatalog.findMany({
    select: { plan: true, displayName: true, monthlyPrice: true, maxBranches: true, maxAgents: true, maxActiveLoans: true, trialDays: true }
  });
  console.log(JSON.stringify(plans, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
