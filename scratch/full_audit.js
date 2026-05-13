const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Tenants
  const tenants = await prisma.tenant.findMany();
  console.log('=== TENANTS ===');
  console.log(JSON.stringify(tenants, null, 2));

  // 2. Users
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, tenantId: true, appType: true, branchId: true, status: true } });
  console.log('\n=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  // 3. Customers
  const customers = await prisma.customer.findMany({ select: { id: true, name: true, customerCode: true, tenantId: true, appType: true, status: true, routeId: true, branchId: true } });
  console.log('\n=== CUSTOMERS ===');
  console.log(`Total: ${customers.length}`);
  console.log(JSON.stringify(customers.slice(0, 5), null, 2));
  const appTypes = {};
  customers.forEach(c => { appTypes[c.appType] = (appTypes[c.appType] || 0) + 1; });
  console.log('By appType:', appTypes);
  const statuses = {};
  customers.forEach(c => { statuses[c.status] = (statuses[c.status] || 0) + 1; });
  console.log('By status:', statuses);

  // 4. Loans
  const loans = await prisma.loan.findMany({ select: { id: true, loanCode: true, tenantId: true, appType: true, status: true, customerId: true, createdById: true, branchId: true } });
  console.log('\n=== LOANS ===');
  console.log(`Total: ${loans.length}`);
  console.log(JSON.stringify(loans.slice(0, 5), null, 2));
  const loanAppTypes = {};
  loans.forEach(l => { loanAppTypes[l.appType] = (loanAppTypes[l.appType] || 0) + 1; });
  console.log('By appType:', loanAppTypes);
  const loanStatuses = {};
  loans.forEach(l => { loanStatuses[l.status] = (loanStatuses[l.status] || 0) + 1; });
  console.log('By status:', loanStatuses);

  // 5. Check for orphaned createdById
  const validUserIds = new Set(users.map(u => u.id));
  const loansWithBadCreator = loans.filter(l => l.createdById && !validUserIds.has(l.createdById));
  console.log('\n=== ORPHANED createdById ===');
  console.log(`Loans with invalid createdById: ${loansWithBadCreator.length}`);
  if (loansWithBadCreator.length > 0) {
    console.log(JSON.stringify(loansWithBadCreator.slice(0, 3), null, 2));
  }

  // 6. AppSettings
  const settings = await prisma.appSetting.findMany({ select: { key: true, value: true, tenantId: true } });
  console.log('\n=== APP SETTINGS ===');
  console.log(JSON.stringify(settings, null, 2));

  // 7. Routes
  const routes = await prisma.route.findMany({ select: { id: true, name: true, tenantId: true, appType: true, status: true } });
  console.log('\n=== ROUTES ===');
  console.log(JSON.stringify(routes, null, 2));

  // 8. Subscriptions
  const subs = await prisma.tenantSubscription.findMany();
  console.log('\n=== SUBSCRIPTIONS ===');
  console.log(JSON.stringify(subs, null, 2));

  // 9. Branches
  const branches = await prisma.branch.findMany({ select: { id: true, name: true, tenantId: true, status: true } });
  console.log('\n=== BRANCHES ===');
  console.log(JSON.stringify(branches, null, 2));

  // 10. Instalments count
  const instCount = await prisma.instalment.count();
  console.log('\n=== INSTALMENTS ===');
  console.log(`Total: ${instCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
