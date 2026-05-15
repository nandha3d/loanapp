'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireModule } from '@/lib/moduleGate';

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role === 'agent') redirect('/collection');
  return session;
}

export async function createChitGroup(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'chitfunds');
  const userId = session.user?.id;

  const name = formData.get('name') as string;
  const chitValue = Number(formData.get('chitValue'));
  const monthlyContrib = Number(formData.get('monthlyContrib'));
  const totalMembers = parseInt(formData.get('totalMembers') as string);
  const commissionPct = Number(formData.get('commissionPct') || '5');
  const startDateStr = formData.get('startDate') as string;
  const startDate = new Date(startDateStr);

  // Member customer IDs (sent as comma-separated or multiple fields)
  const memberIds = formData.getAll('memberIds') as string[];

  if (memberIds.length !== totalMembers) {
    throw new Error(`Expected ${totalMembers} members, got ${memberIds.length}`);
  }

  // Validate all members belong to this tenant/app and are active customers
  const validCustomers = await prisma.customer.findMany({
    where: { id: { in: memberIds }, tenantId, appType, status: 'active' },
    select: { id: true },
  });
  if (validCustomers.length !== memberIds.length) {
    throw new Error('One or more chit members are invalid or inactive for this tenant/app.');
  }

  const chitGroup = await prisma.chitGroup.create({
    data: {
      tenantId,
      appType,
      name,
      chitValue,
      monthlyContrib,
      totalMembers,
      durationMonths: totalMembers,
      commissionPct,
      startDate,
      status: 'active',
    },
  });

  // Create members
  const members = await Promise.all(
    memberIds.map((customerId, idx) =>
      prisma.chitMember.create({
        data: {
          chitGroupId: chitGroup.id,
          customerId,
          memberNumber: idx + 1,
        },
      })
    )
  );

  // Generate ChitSubscription rows for all members × all periods
  for (let period = 1; period <= totalMembers; period++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + period - 1);

    for (const member of members) {
      await prisma.chitSubscription.create({
        data: {
          memberId: member.id,
          periodNumber: period,
          dueDate,
          dueAmount: monthlyContrib,
          status: 'upcoming',
        },
      });
    }
  }

  // Generate ChitAuction stubs for all periods
  for (let period = 1; period <= totalMembers; period++) {
    const auctionDate = new Date(startDate);
    auctionDate.setMonth(auctionDate.getMonth() + period - 1);

    await prisma.chitAuction.create({
      data: {
        chitGroupId: chitGroup.id,
        periodNumber: period,
        auctionDate,
        status: 'pending',
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'create',
      entityType: 'chit_group',
      entityId: chitGroup.id,
      newValue: JSON.stringify({ name, chitValue, totalMembers }),
    },
  });

  revalidatePath('/chits');
  redirect(`/chits/${chitGroup.id}`);
}

export async function recordAuctionWinner(
  auctionId: string,
  winnerMemberId: string,
  prizeAmount: number
) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  await requireModule(tenantId, 'chitfunds');

  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  // Security: verify auction belongs to this tenant
  if (auction.chitGroup.tenantId !== tenantId) throw new Error('Auction not in your tenant');
  if (auction.status === 'completed') throw new Error('Auction already completed');

  const winner = await prisma.chitMember.findFirst({ where: { id: winnerMemberId, chitGroupId: auction.chitGroupId } });
  if (!winner) throw new Error('Member not found in this chit group');
  if (winner.hasWon) throw new Error('This member has already won in this group');

  const chitValue = Number(auction.chitGroup.chitValue);
  const commissionPct = Number(auction.chitGroup.commissionPct);
  const totalMembers = auction.chitGroup.totalMembers;
  const bidDiscount = chitValue - prizeAmount;
  const commission = (bidDiscount * commissionPct) / 100;
  const dividend = totalMembers > 1 ? (bidDiscount - commission) / (totalMembers - 1) : 0;

  await prisma.$transaction([
    prisma.chitAuction.update({
      where: { id: auctionId },
      data: {
        winnerMemberId,
        prizeAmount,
        bidDiscount,
        commission,
        dividend,
        status: 'completed',
      },
    }),
    prisma.chitMember.updateMany({
      where: { id: winnerMemberId, chitGroup: { tenantId } },
      data: { hasWon: true, wonAt: new Date() },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'auction_winner',
      entityType: 'chit_auction',
      entityId: auctionId,
      newValue: JSON.stringify({ winnerMemberId, prizeAmount, bidDiscount, commission, dividend }),
    },
  });

  revalidatePath(`/chits/${auction.chitGroupId}`);
}

export async function recordChitPayment(
  memberId: string,
  periodNumber: number,
  paidAmount: number
) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  await requireModule(tenantId, 'chitfunds');

  // Security: verify subscription belongs to this tenant by joining through ChitGroup
  const sub = await prisma.chitSubscription.findFirst({
    where: {
      memberId,
      periodNumber,
      member: { chitGroup: { tenantId } },
    },
  });
  if (!sub) throw new Error('Subscription not found or not in your tenant');

  await prisma.chitSubscription.update({
    where: { id: sub.id },
    data: {
      paidAmount,
      status: 'paid',
      paidAt: new Date(),
    },
  });

  const member = await prisma.chitMember.findUnique({ where: { id: memberId } });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'chit_payment',
      entityType: 'chit_subscription',
      entityId: sub.id,
      newValue: JSON.stringify({ memberId, periodNumber, paidAmount }),
    },
  });

  revalidatePath(`/chits/${member?.chitGroupId}`);
}
