const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const customers = await prisma.customer.count();
  const loans = await prisma.loan.count();
  const instalments = await prisma.instalment.count();
  console.log({ customers, loans, instalments });
  process.exit(0);
}

check();
