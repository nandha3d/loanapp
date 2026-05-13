import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  const tenant = await prisma.tenant.findFirst();
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant?.id } });
  const user = await prisma.user.findFirst({ where: { tenantId: tenant?.id } });

  if (!tenant || !branch || !user) {
    console.error('Required records not found');
    return;
  }

  const tenantId = tenant.id;
  const branchId = branch.id;
  const userId = user.id;

  console.log('Clearing existing data...');
  await prisma.instalment.deleteMany({ where: { loan: { tenantId } } });
  await prisma.penalty.deleteMany({ where: { loan: { tenantId } } });
  await prisma.loan.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });

  // 1. Create Customers
  const customerNames = [
    'Ramesh Kumar', 'Suresh Raina', 'Priya Sharma', 'Anjali Gupta',
    'Vikram Singh', 'Deepak Verma', 'Meena Kumari', 'Santhosh Kumar'
  ];

  const customers = [];
  for (let i = 0; i < customerNames.length; i++) {
    const customer = await prisma.customer.upsert({
      where: { tenantId_customerCode: { tenantId, customerCode: `CUST${100 + i}` } },
      update: {},
      create: {
        tenantId,
        branchId,
        customerCode: `CUST${100 + i}`,
        name: customerNames[i],
        phone: `9876500${100 + i}`,
        address: `${i + 10}, Main Road, Anna Nagar, Chennai`,
        status: 'active',
        kycStatus: 'verified'
      }
    });
    customers.push(customer);
  }

  // 2. Create Loans
  const loanTypes = ['daily', 'weekly', 'monthly'];
  const amounts = [10000, 20000, 30000, 50000, 100000];

  for (let i = 1; i <= 15; i++) {
    const customer = customers[i % customers.length];
    const principal = amounts[i % amounts.length];
    const frequency = loanTypes[i % loanTypes.length];
    const tenure = frequency === 'daily' ? 100 : frequency === 'weekly' ? 20 : 12;
    const perInst = principal / tenure * 1.1; // Simple calculation
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Started a month ago

    const loan = await prisma.loan.upsert({
      where: { tenantId_loanCode: { tenantId, loanCode: `LN${String(i).padStart(4, '0')}` } },
      update: {},
      create: {
        tenantId,
        branchId,
        loanCode: `LN${String(i).padStart(4, '0')}`,
        customerId: customer.id,
        principal,
        disbursed: principal * 0.95,
        deduction: principal * 0.05,
        frequency,
        tenure,
        startDate,
        perInstalment: Math.round(perInst),
        penaltyRate: 10,
        status: 'active',
        totalInstalments: tenure,
        createdById: userId
      }
    });

    // 3. Create Instalments and some payments
    const instalments = [];
    for (let j = 1; j <= tenure; j++) {
      const dueDate = new Date(startDate);
      if (frequency === 'daily') dueDate.setDate(dueDate.getDate() + j);
      else if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + j * 7);
      else dueDate.setMonth(dueDate.getMonth() + j);

      let status = 'upcoming';
      let receivedAmount = 0;
      let receivedAt = null;

      const today = new Date();
      if (dueDate < today) {
        // Randomly decide status for past due dates
        const rand = Math.random();
        if (rand > 0.4) {
          status = 'paid';
          receivedAmount = Math.round(perInst);
          receivedAt = new Date(dueDate);
        } else if (rand > 0.15) {
          status = 'partial';
          receivedAmount = Math.round(perInst * 0.4);
          receivedAt = new Date(dueDate);
        } else {
          status = 'missed';
          receivedAmount = 0;
        }
      }

      // Normalize dueDate to UTC Midnight to avoid timezone shifts
      const normalizedDueDate = new Date(Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()));

      instalments.push({
        loanId: loan.id,
        instalmentNo: j,
        dueDate: normalizedDueDate,
        dueAmount: Math.round(perInst),
        receivedAmount,
        status,
        receivedAt
      });
    }

    // Use createMany for speed if possible, but prisma instalment has unique constraint
    for (const inst of instalments) {
      await prisma.instalment.upsert({
        where: { loanId_instalmentNo: { loanId: inst.loanId, instalmentNo: inst.instalmentNo } },
        update: inst,
        create: inst
      });
    }

    // Update loan summary
    const paidCount = instalments.filter(inst => inst.status === 'paid').length;
    const totalCollected = instalments.reduce((acc, inst) => acc + Number(inst.receivedAmount), 0);
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidCount,
        totalCollected
      }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
