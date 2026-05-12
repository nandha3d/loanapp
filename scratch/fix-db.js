const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing currency symbol and encoding...');
  
  // 1. Fix the currency symbol setting
  const symbolRow = await prisma.appSetting.findFirst({
    where: { key: 'currency_symbol' }
  });
  
  if (symbolRow) {
    await prisma.appSetting.update({
      where: { id: symbolRow.id },
      data: { value: '₹' }
    });
    console.log(`Updated currency symbol to ₹ for id: ${symbolRow.id}`);
  } else {
    console.log('Currency symbol setting not found.');
  }

  // 2. Add language setting if missing
  const langRow = await prisma.appSetting.findFirst({
    where: { key: 'language' }
  });
  
  if (!langRow && symbolRow) {
    await prisma.appSetting.create({
      data: {
        tenantId: symbolRow.tenantId,
        key: 'language',
        value: 'en',
        group: 'system'
      }
    });
    console.log('Added default language setting (en).');
  }

  console.log('Done.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
