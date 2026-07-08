import prisma from '../lib/db';
import { calculateChitAuction } from '../lib/chits/calculations';
import { chitContributionToBranch, chitPayoutFromBranch } from '../lib/wallet';
import type { ChitAuction, ChitMember, Customer } from '@prisma/client';

const appType = 'chitfunds';
const groupName = 'Demo Production Chit - 5 x 10000';

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'LoanTrack', slug: 'default' },
  });
  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CHIT-DEMO' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Chit Demo Branch', code: 'CHIT-DEMO', enabledModules: JSON.stringify([appType]) },
  });

  const existing = await prisma.chitGroup.findFirst({
    where: { tenantId: tenant.id, appType, name: groupName, deletedAt: null },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(`Chit demo already exists: ${existing.name} (${existing.id})`);
    return;
  }

  const customers: Customer[] = [];
  for (let i = 1; i <= 5; i++) {
    const code = `CHIT-DEMO-${String(i).padStart(2, '0')}`;
    const customer = await prisma.customer.upsert({
      where: { tenantId_customerCode: { tenantId: tenant.id, customerCode: code } },
      update: { appType, branchId: branch.id, status: 'active' },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        appType,
        customerCode: code,
        name: `Chit Demo Subscriber ${i}`,
        phone: `90000010${i}`,
        address: 'Demo chit subscriber address',
        status: 'active',
        kycStatus: 'verified',
      },
    });
    customers.push(customer);
  }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const group = await prisma.chitGroup.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      appType,
      name: groupName,
      chitValue: 50000,
      monthlyContrib: 10000,
      totalMembers: 5,
      durationMonths: 5,
      commissionPct: 5,
      startDate,
      status: 'active',
      complianceStatus: 'active',
      chitType: 'registered',
      auctionType: 'open_manual',
      commissionBasis: 'BID_DISCOUNT',
      gstPct: 18,
      dividendPolicy: 'ALL_MEMBERS',
      dividendDistribution: 'ADJUST_NEXT_DUE',
      dividendRounding: 10,
      minDiscountPct: 5,
      maxDiscountPct: 40,
      bidIncrement: 500,
      tieBreakRule: 'EARLIEST_BID',
      hasForemanTicket: true,
      registrationNo: 'REG-DEMO-CHIT-001',
      registrationDate: startDate,
      registrarOffice: 'Demo Registrar Office',
      bylawNo: 'BYLAW-DEMO-001',
      commencementCertificate: 'COMM-DEMO-001',
      approvedBankName: 'Demo Cooperative Bank',
      approvedBankAccountNo: '000111222333',
      foremanName: 'Demo Foreman',
      foremanCommissionCapPct: 5,
    },
  });

  const members: ChitMember[] = [];
  for (let i = 0; i < customers.length; i++) {
    const member = await prisma.chitMember.create({
      data: {
        chitGroupId: group.id,
        customerId: customers[i].id,
        memberNumber: i + 1,
        ticketNo: String(i + 1),
        ticketShare: 1,
        subscriberStatus: 'active',
        agreementStatus: 'verified',
        agreementSignedAt: startDate,
        nomineeName: `Nominee ${i + 1}`,
        nomineeRelation: 'Family',
        nomineePhone: `91111110${i + 1}`,
        introducedBy: 'seed',
        isForemanTicket: i === 0,
      },
    });
    members.push(member);
  }

  const auctions: ChitAuction[] = [];
  for (let period = 1; period <= 5; period++) {
    const auction = await prisma.chitAuction.create({
      data: {
        chitGroupId: group.id,
        periodNumber: period,
        auctionDate: addMonths(startDate, period - 1),
        scheduledAt: addMonths(startDate, period - 1),
        noticeStatus: period === 1 ? 'sent' : 'pending',
        payoutStatus: period === 1 ? 'paid' : 'not_ready',
        status: period === 1 ? 'completed' : 'pending',
      },
    });
    auctions.push(auction);
  }

  const calc = calculateChitAuction({
    chitValue: 50000,
    prizeAmount: 42000,
    commissionPct: 5,
    totalMembers: 5,
    commissionBasis: 'BID_DISCOUNT',
    gstPct: 18,
    dividendPolicy: 'ALL_MEMBERS',
    dividendRounding: 10,
  });

  await prisma.chitAuction.update({
    where: { id: auctions[0].id },
    data: {
      winnerMemberId: members[1].id,
      prizeAmount: 42000,
      bidDiscount: calc.bidDiscount,
      commission: calc.commission,
      dividend: calc.dividend,
      gstAmount: calc.gstAmount,
      roundingIncome: calc.roundingIncome,
      minutesText: 'Demo auction confirmed from seed data.',
      confirmedAt: new Date(),
      completedAt: new Date(),
    },
  });
  await prisma.chitMember.update({
    where: { id: members[1].id },
    data: { hasWon: true, wonAt: new Date() },
  });

  for (const member of members) {
    await prisma.chitAuctionAttendance.create({
      data: { tenantId: tenant.id, branchId: branch.id, auctionId: auctions[0].id, memberId: member.id, status: 'present' },
    });
  }
  await prisma.chitBid.createMany({
    data: [
      { tenantId: tenant.id, branchId: branch.id, auctionId: auctions[0].id, chitGroupId: group.id, memberId: members[1].id, bidAmount: 42000, bidDiscount: 8000, status: 'winning' },
      { tenantId: tenant.id, branchId: branch.id, auctionId: auctions[0].id, chitGroupId: group.id, memberId: members[2].id, bidAmount: 43000, bidDiscount: 7000, status: 'valid' },
    ],
  });

  for (const member of members) {
    for (let period = 1; period <= 5; period++) {
      await prisma.chitSubscription.create({
        data: {
          memberId: member.id,
          periodNumber: period,
          dueDate: addMonths(startDate, period - 1),
          dueAmount: period === 2 ? 10000 : 9990,
          baseDueAmount: 10000,
          dividendAmount: period === 1 ? calc.dividend : 0,
          paidAmount: period === 1 ? 9990 : 0,
          status: period === 1 ? 'paid' : 'upcoming',
          paidAt: period === 1 ? new Date() : null,
          paymentMode: period === 1 ? 'cash' : null,
        },
      });
    }
  }

  const firstSub = await prisma.chitSubscription.findFirstOrThrow({
    where: { memberId: members[0].id, periodNumber: 1 },
  });
  const periodTwoSub = await prisma.chitSubscription.findFirstOrThrow({
    where: { memberId: members[2].id, periodNumber: 2 },
  });

  await prisma.$transaction(async (tx) => {
    await tx.chitSecurity.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        chitGroupId: group.id,
        auctionId: auctions[0].id,
        winnerMemberId: members[1].id,
        securityType: 'guarantor',
        securityValue: 42000,
        guarantorName: 'Demo Guarantor',
        guarantorPhone: '9222222201',
        details: 'Seeded approved security.',
        status: 'approved',
        submittedAt: new Date(),
        verifiedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    await tx.chitReceipt.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        appType,
        receiptNo: `CR-${Date.now()}`,
        receiptType: 'collection',
        entityType: 'subscription',
        entityId: firstSub.id,
        amount: 9990,
        paymentMode: 'cash',
        notes: 'Seed collection receipt',
      },
    });
    await tx.accountEntry.create({
      data: {
        tenantId: tenant.id,
        appType,
        branchId: branch.id,
        entryDate: new Date(),
        type: 'chit_collection',
        category: 'cash',
        amount: 9990,
        description: 'Seed chit contribution',
        referenceId: firstSub.id,
        referenceType: 'chit_subscription',
      },
    });
    await chitContributionToBranch(tx, { tenantId: tenant.id, appType, branchId: branch.id, amount: 9990, refId: firstSub.id });
    await tx.chitReceipt.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        appType,
        receiptNo: `CP-${Date.now()}`,
        receiptType: 'payout',
        entityType: 'auction',
        entityId: auctions[0].id,
        amount: 42000,
        paymentMode: 'cash',
        notes: 'Seed payout receipt',
      },
    });
    await tx.accountEntry.create({
      data: {
        tenantId: tenant.id,
        appType,
        branchId: branch.id,
        entryDate: new Date(),
        type: 'chit_payout',
        category: 'cash',
        amount: 42000,
        description: 'Seed chit payout',
        referenceId: auctions[0].id,
        referenceType: 'chit_auction',
      },
    });
    await chitPayoutFromBranch(tx, { tenantId: tenant.id, appType, branchId: branch.id, amount: 42000, refId: auctions[0].id });
    await tx.chitPenalty.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        subscriptionId: periodTwoSub.id,
        memberId: members[2].id,
        penaltyType: 'late_fee',
        amount: 250,
        status: 'due',
        reason: 'Seed pending late fee',
      },
    });
    await tx.chitSubscription.update({
      where: { id: periodTwoSub.id },
      data: { penaltyAmount: 250, status: 'missed' },
    });
  });

  console.log(`Created chit demo group: ${group.name} (${group.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
