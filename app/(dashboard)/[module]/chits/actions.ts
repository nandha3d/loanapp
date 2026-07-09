'use server';

import prisma from '@/lib/db';
import { modulePath } from '@/types/modules';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { calculateFixedDiscountPrize, roundMoney } from '@/lib/chits/calculations';
import { collectChitSubscriptionPayment } from '@/lib/chits/collections';
import { createChitAudit } from '@/lib/chits/audit';
import {
  assertChitRole,
  canAdminChits,
  canApproveChitSecurity,
  canCollectChits,
  getWebChitScope,
  scopedChitGroupWhere,
} from '@/lib/chits/access';
import { getTopBids, getWinningBid } from '@/lib/chits/auction';
import { drawLotteryWinner, formatDrawEvidence } from '@/lib/chits/lottery';
import { finalizeAuctionInTx } from '@/lib/chits/finalize';
import {
  antiSnipeExtension,
  closeAuctionRoom,
  closeRoomIfExpired,
  isRoomOpen,
  openAuctionRoom,
  secondsRemaining,
} from '@/lib/chits/liveAuction';
import { releaseChitPrizePayout } from '@/lib/chits/payout';
import { assertCanReleasePrizePayout } from '@/lib/chits/security';
import {
  assertValidCommissionPct,
  assertValidPrizeAmount,
  validateChitConfig,
  validateChitGroupActivation,
} from '@/lib/chits/validation';
import { generateCode } from '@/lib/utils';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function numberValue(formData: FormData, key: string, fallback?: number) {
  const raw = value(formData, key);
  if (raw == null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextPeriodDate(startDate: Date, period: number, frequency: string) {
  const dueDate = new Date(startDate);
  if (frequency === 'daily') dueDate.setDate(dueDate.getDate() + period - 1);
  else if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + (period - 1) * 7);
  else if (frequency === 'fortnightly') dueDate.setDate(dueDate.getDate() + (period - 1) * 14);
  else dueDate.setMonth(dueDate.getMonth() + period - 1);
  return dueDate;
}

async function loadScopedGroup(idOrCode: string) {
  const scope = await getWebChitScope();
  const group = await prisma.chitGroup.findFirst({
    where: scopedChitGroupWhere(scope, { OR: [{ id: idOrCode }, { groupCode: idOrCode }] }),
  });
  if (!group) throw new Error('Chit group not found');
  return { scope, group };
}

export async function createChitGroup(formData: FormData) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);

  const name = value(formData, 'name');
  const chitValue = numberValue(formData, 'chitValue');
  const monthlyContrib = numberValue(formData, 'monthlyContrib');
  const totalMembers = numberValue(formData, 'totalMembers');
  const durationMonths = numberValue(formData, 'durationMonths', totalMembers);
  const commissionPct = numberValue(formData, 'commissionPct', 5) ?? 5;
  const startDate = dateValue(formData, 'startDate') ?? new Date();
  const memberIds = Array.from(new Set(formData.getAll('memberIds').map(String).filter(Boolean)));

  if (!name) throw new Error('Chit group name is required');
  if (!chitValue || chitValue <= 0) throw new Error('Chit value must be greater than zero');
  if (!monthlyContrib || monthlyContrib <= 0) throw new Error('Installment amount must be greater than zero');
  if (!totalMembers || totalMembers <= 0) throw new Error('Total members must be greater than zero');
  if (memberIds.length > totalMembers) throw new Error('Selected members cannot exceed total members');

  const maxDiscountPct = numberValue(formData, 'maxDiscountPct');
  const minDiscountPct = numberValue(formData, 'minDiscountPct');
  const foremanCommissionCapPct = numberValue(formData, 'foremanCommissionCapPct');
  validateChitConfig({
    auctionType: value(formData, 'auctionType') ?? 'open_manual',
    commissionBasis: value(formData, 'commissionBasis') ?? 'BID_DISCOUNT',
    dividendPolicy: value(formData, 'dividendPolicy') ?? 'ALL_MEMBERS',
    dividendDistribution: value(formData, 'dividendDistribution') ?? 'ADJUST_NEXT_DUE',
    tieBreakRule: value(formData, 'tieBreakRule') ?? 'EARLIEST_BID',
    minDiscountPct,
    maxDiscountPct,
    fixedDiscountPct: numberValue(formData, 'fixedDiscountPct'),
  });
  assertValidCommissionPct({ commissionPct, foremanCommissionCapPct });

  const validCustomers = memberIds.length
    ? await prisma.customer.findMany({
        where: {
          id: { in: memberIds },
          tenantId: scope.tenantId,
          appType: scope.appType,
          status: 'active',
          deletedAt: null,
          ...(scope.branchId && scope.role !== 'superadmin' && scope.role !== 'developer' ? { branchId: scope.branchId } : {}),
        },
        select: { id: true },
      })
    : [];
  if (validCustomers.length !== memberIds.length) {
    throw new Error('One or more chit members are invalid or inactive for this tenant/app/branch.');
  }

  const group = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.chitGroup.count({ where: { tenantId: scope.tenantId } });
    const groupCode = generateCode('CF', existingCount + 1, 5);
    const created = await tx.chitGroup.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId || undefined,
        appType: scope.appType,
        groupCode,
        name,
        chitValue,
        monthlyContrib,
        totalMembers,
        durationMonths: durationMonths ?? totalMembers,
        commissionPct,
        startDate,
        status: 'draft',
        complianceStatus: 'draft',
        chitType: value(formData, 'chitType') ?? 'unregistered',
        auctionType: value(formData, 'auctionType') ?? 'open_manual',
        auctionFrequency: value(formData, 'auctionFrequency') ?? 'monthly',
        auctionMode: value(formData, 'auctionMode') ?? 'offline',
        auctionDay: numberValue(formData, 'auctionDay'),
        registrationNo: value(formData, 'registrationNo'),
        registrationDate: dateValue(formData, 'registrationDate'),
        registrarOffice: value(formData, 'registrarOffice'),
        bylawNo: value(formData, 'bylawNo'),
        commencementCertificate: value(formData, 'commencementCertificate'),
        approvedBankName: value(formData, 'approvedBankName'),
        approvedBankAccountNo: value(formData, 'approvedBankAccountNo'),
        foremanName: value(formData, 'foremanName'),
        foremanCommissionCapPct,
        maxDiscountPct,
        minDiscountPct,
        fixedDiscountPct: numberValue(formData, 'fixedDiscountPct'),
        commissionBasis: value(formData, 'commissionBasis') ?? 'BID_DISCOUNT',
        gstPct: numberValue(formData, 'gstPct'),
        dividendPolicy: value(formData, 'dividendPolicy') ?? 'ALL_MEMBERS',
        dividendDistribution: value(formData, 'dividendDistribution') ?? 'ADJUST_NEXT_DUE',
        dividendRounding: numberValue(formData, 'dividendRounding', 0) ?? 0,
        bidIncrement: numberValue(formData, 'bidIncrement'),
        tieBreakRule: value(formData, 'tieBreakRule') ?? 'EARLIEST_BID',
        hasForemanTicket: value(formData, 'hasForemanTicket') === 'true',
        remarks: value(formData, 'remarks'),
      },
    });

    for (const [idx, customerId] of memberIds.entries()) {
      await tx.chitMember.create({
        data: {
          chitGroupId: created.id,
          customerId,
          memberNumber: idx + 1,
          ticketNo: String(idx + 1),
          ticketShare: 1,
          agreementStatus: 'pending',
        },
      });
    }

    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'create_draft',
      entityType: 'chit_group',
      entityId: created.id,
      newValue: { name, chitValue, totalMembers },
    });
    return created;
  });

  revalidatePath(modulePath(scope.appType, '/chits'));
  redirect(modulePath(scope.appType, `/chits/${group.groupCode ?? group.id}`));
}

export async function autoAssignChitTicketNumbers(groupId: string) {
  const { scope, group } = await loadScopedGroup(groupId);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (group.status !== 'draft') {
    throw new Error('Ticket numbers can only be auto-assigned while the group is in draft');
  }

  const members = await prisma.chitMember.findMany({
    where: { chitGroupId: group.id },
    orderBy: { memberNumber: 'asc' },
    select: { id: true, memberNumber: true, ticketNo: true },
  });

  // Only fill in members missing a ticket number — never overwrite an existing
  // (possibly manually set or share-split) ticket number.
  const used = new Set(members.map((m) => m.ticketNo).filter(Boolean) as string[]);
  let assignedCount = 0;

  await prisma.$transaction(async (tx) => {
    let candidate = 1;
    for (const member of members) {
      if (member.ticketNo) continue;
      while (used.has(String(candidate))) candidate += 1;
      const ticketNo = String(candidate);
      used.add(ticketNo);
      candidate += 1;
      await tx.chitMember.update({ where: { id: member.id }, data: { ticketNo } });
      assignedCount += 1;
    }
    if (assignedCount) {
      await createChitAudit(tx, {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'auto_assign_ticket_numbers',
        entityType: 'chit_group',
        entityId: group.id,
        newValue: { assignedCount },
      });
    }
  });

  revalidatePath(modulePath(scope.appType, `/chits/${group.id}`));
}

export async function activateChitGroup(groupId: string) {
  const { scope, group } = await loadScopedGroup(groupId);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (group.status === 'active') throw new Error('Chit group is already active');

  const members = await prisma.chitMember.findMany({
    where: { chitGroupId: group.id },
    select: {
      id: true,
      ticketNo: true,
      ticketShare: true,
      agreementStatus: true,
      isForemanTicket: true,
      hasWon: true,
      customer: { select: { name: true } },
    },
  });
  const ticketCounts = new Map<string, number>();
  const ticketShares = new Map<string, number>();
  for (const member of members) {
    if (!member.ticketNo) continue;
    ticketCounts.set(member.ticketNo, (ticketCounts.get(member.ticketNo) ?? 0) + 1);
    ticketShares.set(member.ticketNo, (ticketShares.get(member.ticketNo) ?? 0) + Number(member.ticketShare));
  }
  const invalidShareCount = Array.from(ticketShares.values()).filter((sum) => Math.abs(sum - 1) > 0.001).length;
  if (invalidShareCount) throw new Error('Each ticket share total must equal 1.00');

  validateChitGroupActivation({
    chitType: group.chitType,
    registrationNo: group.registrationNo,
    registrationDate: group.registrationDate,
    registrarOffice: group.registrarOffice,
    bylawNo: group.bylawNo,
    commencementCertificate: group.commencementCertificate,
    approvedBankName: group.approvedBankName,
    foremanName: group.foremanName,
    commissionPct: Number(group.commissionPct),
    foremanCommissionCapPct: group.foremanCommissionCapPct ? Number(group.foremanCommissionCapPct) : null,
    maxDiscountPct: group.maxDiscountPct ? Number(group.maxDiscountPct) : null,
    totalMembers: group.totalMembers,
    actualMembers: members.length,
    distinctTicketCount: ticketCounts.size,
    missingTicketCount: members.filter((member) => !member.ticketNo).length,
    duplicateTicketCount: 0,
    pendingAgreementCount: members.filter((member) => !['signed', 'verified'].includes(member.agreementStatus)).length,
    hasForemanTicket: group.hasForemanTicket,
    foremanTicketCount: members.filter((member) => member.isForemanTicket).length,
  });

  await prisma.$transaction(async (tx) => {
    const existingSubscriptions = await tx.chitSubscription.count({
      where: { member: { chitGroupId: group.id } },
    });
    const existingAuctions = await tx.chitAuction.count({ where: { chitGroupId: group.id } });
    const periodCount = group.totalMembers;
    if (!existingSubscriptions) {
      for (let period = 1; period <= periodCount; period++) {
        const dueDate = nextPeriodDate(group.startDate, period, group.auctionFrequency);
        for (const member of members) {
          await tx.chitSubscription.create({
            data: {
              memberId: member.id,
              periodNumber: period,
              dueDate,
              dueAmount: Number(group.monthlyContrib) * Number(member.ticketShare),
              baseDueAmount: Number(group.monthlyContrib) * Number(member.ticketShare),
              status: 'upcoming',
            },
          });
        }
      }
    }
    if (!existingAuctions) {
      for (let period = 1; period <= periodCount; period++) {
        await tx.chitAuction.create({
          data: {
            chitGroupId: group.id,
            periodNumber: period,
            auctionDate: nextPeriodDate(group.startDate, period, group.auctionFrequency),
            scheduledAt: nextPeriodDate(group.startDate, period, group.auctionFrequency),
            status: 'pending',
          },
        });
      }
    }
    await tx.chitGroup.update({
      where: { id: group.id },
      data: { status: 'active', complianceStatus: 'active' },
    });

    // Foreman/company ticket takes the period-1 prize without an auction (doc 11 §7).
    const foremanMember = group.hasForemanTicket
      ? members.find((member) => member.isForemanTicket && !member.hasWon)
      : null;
    if (foremanMember) {
      const periodOne = await tx.chitAuction.findFirst({
        where: { chitGroupId: group.id, periodNumber: 1, status: 'pending', winnerMemberId: null },
      });
      if (periodOne) {
        const fixed = calculateFixedDiscountPrize({
          chitValue: Number(group.chitValue),
          fixedDiscountPct: group.fixedDiscountPct ? Number(group.fixedDiscountPct) : 0,
        });
        const branch = group.branchId
          ? await tx.branch.findUnique({ where: { id: group.branchId }, select: { code: true } })
          : null;
        const bid = await tx.chitBid.create({
          data: {
            tenantId: scope.tenantId,
            branchId: group.branchId,
            auctionId: periodOne.id,
            chitGroupId: group.id,
            memberId: foremanMember.id,
            bidAmount: fixed.prizeAmount,
            bidDiscount: fixed.bidDiscount,
            remarks: 'Foreman ticket — period 1 prize taken without auction',
            createdById: scope.userId || undefined,
          },
        });
        await finalizeAuctionInTx(tx, {
          scope,
          auction: periodOne,
          group,
          branchCode: branch?.code,
          selectedBid: bid,
          winnerName: foremanMember.customer.name,
          winnerTicketNo: foremanMember.ticketNo,
          presentCount: 0,
          drawEvidence: 'Foreman ticket — period 1 prize taken without auction.',
          auditAction: 'foreman_ticket_resolve',
        });
      }
    }

    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'activate',
      entityType: 'chit_group',
      entityId: group.id,
      newValue: { status: 'active', complianceStatus: 'active' },
    });
  });

  revalidatePath(modulePath(scope.appType, '/chits'));
  revalidatePath(modulePath(scope.appType, `/chits/${group.id}`));
}

export async function updateChitMemberDetails(memberId: string, formData: FormData) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const member = await prisma.chitMember.findFirst({
    where: { id: memberId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!member) throw new Error('Chit member not found');

  const data = {
    // Ticket no is auto-assigned at enrollment; never silently wipe it if the field is left blank.
    ticketNo: value(formData, 'ticketNo') ?? member.ticketNo,
    fractionNo: value(formData, 'fractionNo'),
    ticketShare: numberValue(formData, 'ticketShare', Number(member.ticketShare)),
    nomineeName: value(formData, 'nomineeName'),
    nomineeRelation: value(formData, 'nomineeRelation'),
    nomineePhone: value(formData, 'nomineePhone'),
    introducedBy: value(formData, 'introducedBy'),
    agreementStatus: value(formData, 'agreementStatus') ?? member.agreementStatus,
    subscriberStatus: value(formData, 'subscriberStatus') ?? member.subscriberStatus,
    isForemanTicket: value(formData, 'isForemanTicket') === 'true',
  };

  await prisma.$transaction(async (tx) => {
    await tx.chitMember.update({ where: { id: member.id }, data });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'update_member',
      entityType: 'chit_member',
      entityId: member.id,
      oldValue: { ticketNo: member.ticketNo, agreementStatus: member.agreementStatus },
      newValue: data,
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${member.chitGroupId}`));
}

export async function markChitAgreementSigned(memberId: string) {
  const formData = new FormData();
  formData.set('agreementStatus', 'signed');
  await updateChitMemberDetails(memberId, formData);
}

export async function verifyChitAgreement(memberId: string) {
  const formData = new FormData();
  formData.set('agreementStatus', 'verified');
  await updateChitMemberDetails(memberId, formData);
}

export async function rejectChitAgreement(memberId: string, reason: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const member = await prisma.chitMember.findFirst({
    where: { id: memberId, chitGroup: scopedChitGroupWhere(scope) },
  });
  if (!member) throw new Error('Chit member not found');
  await prisma.$transaction(async (tx) => {
    await tx.chitMember.update({ where: { id: member.id }, data: { agreementStatus: 'rejected' } });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'reject_agreement',
      entityType: 'chit_member',
      entityId: member.id,
      newValue: { reason },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${member.chitGroupId}`));
}

export async function markAuctionNoticeSent(auctionId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
  });
  if (!auction) throw new Error('Auction not found');
  await prisma.chitAuction.update({
    where: { id: auction.id },
    data: { status: 'notice_sent', noticeStatus: 'sent' },
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function markAuctionAttendance(auctionId: string, memberId: string, status = 'present', proxyName?: string | null) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (status === 'proxy' && !proxyName) throw new Error('Proxy name is required');
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: auction.chitGroupId } });
  if (!member) throw new Error('Member not found in this chit group');

  await prisma.chitAuctionAttendance.upsert({
    where: { auctionId_memberId: { auctionId, memberId } },
    create: {
      tenantId: scope.tenantId,
      branchId: auction.chitGroup.branchId,
      auctionId,
      memberId,
      status,
      proxyName: proxyName || null,
      markedById: scope.userId || undefined,
    },
    update: { status, proxyName: proxyName || null, markedById: scope.userId || undefined, markedAt: new Date() },
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function addAuctionBid(auctionId: string, memberId: string, prizeAmount: number, remarks?: string | null) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');
  if (['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
    throw new Error('This chit uses a draw — bids are not accepted. Use the draw action instead.');
  }
  const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: auction.chitGroupId } });
  if (!member) throw new Error('Member not found in this chit group');
  if (member.hasWon) throw new Error('This member has already won in this group');
  if (member.subscriberStatus !== 'active') throw new Error(`A ${member.subscriberStatus} ticket cannot bid`);

  assertValidPrizeAmount({
    chitValue: Number(auction.chitGroup.chitValue),
    prizeAmount,
    maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: Number(auction.chitGroup.commissionPct),
  });
  const bidDiscount = Number(auction.chitGroup.chitValue) - prizeAmount;

  const bid = await prisma.$transaction(async (tx) => {
    // Live room: lazily close on expiry, require an open room, apply anti-snipe extension.
    if (auction.chitGroup.auctionType === 'open_live') {
      await closeRoomIfExpired(tx, auctionId);
      const fresh = await tx.chitAuction.findUnique({
        where: { id: auctionId },
        select: { roomStatus: true, biddingClosesAt: true, autoExtendSeconds: true },
      });
      if (!fresh || !isRoomOpen(fresh)) throw new Error('Bidding room is not open');
      const extendedClose = antiSnipeExtension(fresh);
      if (extendedClose) {
        await tx.chitAuction.update({
          where: { id: auctionId },
          data: { biddingClosesAt: extendedClose, roomStatus: 'extended' },
        });
      }
    }

    // Bid increment step; exact-cap bids always accepted so cap ties can form.
    if (auction.chitGroup.bidIncrement) {
      const capDiscount = auction.chitGroup.maxDiscountPct
        ? roundMoney((Number(auction.chitGroup.chitValue) * Number(auction.chitGroup.maxDiscountPct)) / 100)
        : null;
      const highest = await tx.chitBid.aggregate({
        where: { auctionId, status: 'valid' },
        _max: { bidDiscount: true },
      });
      const currentHighest = highest._max.bidDiscount ? Number(highest._max.bidDiscount) : 0;
      const atCap = capDiscount != null && bidDiscount === capDiscount;
      if (!atCap && currentHighest > 0 && bidDiscount < currentHighest + Number(auction.chitGroup.bidIncrement)) {
        throw new Error(`Bid discount must exceed the current highest (${currentHighest}) by at least ${Number(auction.chitGroup.bidIncrement)}`);
      }
    }

    const created = await tx.chitBid.create({
      data: {
        tenantId: scope.tenantId,
        branchId: auction.chitGroup.branchId,
        auctionId,
        chitGroupId: auction.chitGroupId,
        memberId,
        bidAmount: prizeAmount,
        bidDiscount,
        remarks,
        createdById: scope.userId || undefined,
      },
    });
    await tx.chitAuction.update({
      where: { id: auction.id },
      data: { status: auction.status === 'pending' ? 'in_progress' : auction.status, startedAt: auction.startedAt ?? new Date() },
    });
    return created;
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  return bid;
}

export async function confirmAuction(auctionId: string, winningBidId?: string | null, minutesText?: string | null) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: {
      chitGroup: { include: { branch: true } },
      bids: { include: { member: { include: { customer: true } } }, orderBy: { bidTime: 'asc' } },
      attendance: true,
    },
  });
  if (!auction) throw new Error('Auction not found');
  if (['confirmed', 'paid'].includes(auction.status)) throw new Error('Auction already confirmed');

  const comparableBids = auction.bids.map((bid) => ({
    ...bid,
    bidDiscount: Number(bid.bidDiscount),
    bidTime: bid.bidTime,
  }));
  let drawEvidence: string | null = null;
  let selectedBid = winningBidId ? auction.bids.find((bid) => bid.id === winningBidId) : undefined;
  if (!winningBidId) {
    const topBids = getTopBids(comparableBids);
    if (topBids.length > 1 && auction.chitGroup.tieBreakRule === 'LOTTERY_AMONG_TIED') {
      const uniqueMembers = new Map<string, typeof topBids[number]>();
      for (const bid of topBids) if (!uniqueMembers.has(bid.memberId)) uniqueMembers.set(bid.memberId, bid);
      const draw = drawLotteryWinner({
        auctionId: auction.id,
        candidates: Array.from(uniqueMembers.values()).map((bid) => ({
          memberId: bid.memberId,
          ticketNo: bid.member.ticketNo ?? bid.member.memberNumber.toString(),
          memberName: bid.member.customer.name,
        })),
      });
      selectedBid = auction.bids.find((bid) => bid.id === uniqueMembers.get(draw.winner.memberId)?.id);
      drawEvidence = `Tie at highest discount. ${formatDrawEvidence(draw)}`;
    } else {
      const winner = getWinningBid(comparableBids);
      selectedBid = winner ? auction.bids.find((bid) => bid.id === winner.id) : undefined;
    }
  }
  if (!selectedBid) throw new Error('At least one valid bid is required');
  if (selectedBid.status !== 'valid') throw new Error('Winning bid must be valid');
  if (selectedBid.member.hasWon) throw new Error('Winning member has already won');

  await prisma.$transaction(async (tx) => {
    await finalizeAuctionInTx(tx, {
      scope,
      auction,
      group: auction.chitGroup,
      branchCode: auction.chitGroup.branch?.code,
      selectedBid,
      winnerName: selectedBid.member.customer.name,
      winnerTicketNo: selectedBid.member.ticketNo,
      presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
      minutesText,
      drawEvidence,
      auditAction: 'confirm_auction',
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

// Resolves a lottery or fixed_rotation period without bids: lottery uses the audited
// random draw; fixed_rotation takes the lowest unprized ticket. Creates a synthetic
// winning bid at the group's fixed discount so downstream flows match auctions.
export async function drawAuctionWinner(auctionId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: { include: { branch: true } }, attendance: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (!['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
    throw new Error('Draw is only available for lottery or fixed rotation chits');
  }
  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');

  const eligible = await prisma.chitMember.findMany({
    where: {
      chitGroupId: auction.chitGroupId,
      hasWon: false,
      subscriberStatus: 'active',
      ticketNo: { not: null },
    },
    include: { customer: true },
  });
  if (!eligible.length) throw new Error('No eligible tickets for this period');

  let winnerMember: (typeof eligible)[number];
  let drawEvidence: string;
  if (auction.chitGroup.auctionType === 'lottery') {
    const draw = drawLotteryWinner({
      auctionId: auction.id,
      candidates: eligible.map((member) => ({
        memberId: member.id,
        ticketNo: member.ticketNo as string,
        memberName: member.customer.name,
      })),
    });
    winnerMember = eligible.find((member) => member.id === draw.winner.memberId) as (typeof eligible)[number];
    drawEvidence = formatDrawEvidence(draw);
  } else {
    winnerMember = [...eligible].sort((a, b) =>
      (a.ticketNo as string).localeCompare(b.ticketNo as string, undefined, { numeric: true })
    )[0];
    drawEvidence = `Fixed rotation: ticket ${winnerMember.ticketNo} is next in payout order.`;
  }

  const fixed = calculateFixedDiscountPrize({
    chitValue: Number(auction.chitGroup.chitValue),
    fixedDiscountPct: auction.chitGroup.fixedDiscountPct ? Number(auction.chitGroup.fixedDiscountPct) : 0,
  });

  await prisma.$transaction(async (tx) => {
    const bid = await tx.chitBid.create({
      data: {
        tenantId: scope.tenantId,
        branchId: auction.chitGroup.branchId,
        auctionId: auction.id,
        chitGroupId: auction.chitGroupId,
        memberId: winnerMember.id,
        bidAmount: fixed.prizeAmount,
        bidDiscount: fixed.bidDiscount,
        remarks: drawEvidence,
        createdById: scope.userId || undefined,
      },
    });
    await finalizeAuctionInTx(tx, {
      scope,
      auction,
      group: auction.chitGroup,
      branchCode: auction.chitGroup.branch?.code,
      selectedBid: bid,
      winnerName: winnerMember.customer.name,
      winnerTicketNo: winnerMember.ticketNo,
      presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
      drawEvidence,
      auditAction: 'draw_winner',
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function recordAuctionWinner(auctionId: string, winnerMemberId: string, prizeAmount: number) {
  const bid = await addAuctionBid(auctionId, winnerMemberId, prizeAmount, 'Recorded from legacy winner action');
  await confirmAuction(auctionId, bid.id);
}

export async function submitChitSecurity(auctionId: string, formData: FormData) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction || !auction.winnerMemberId) throw new Error('Auction winner is required before security');
  const status = value(formData, 'action') === 'verify' ? 'verified' : value(formData, 'action') === 'approve' ? 'approved' : value(formData, 'action') === 'reject' ? 'rejected' : 'submitted';
  if ((status === 'approved' || status === 'rejected') && !canApproveChitSecurity(scope.role)) throw new Error('Forbidden');

  await prisma.$transaction(async (tx) => {
    const security = await tx.chitSecurity.findFirst({ where: { auctionId: auction.id } });
    const data: any = {
      securityType: value(formData, 'securityType') ?? security?.securityType ?? 'guarantor',
      securityValue: numberValue(formData, 'securityValue'),
      guarantorName: value(formData, 'guarantorName'),
      guarantorPhone: value(formData, 'guarantorPhone'),
      details: value(formData, 'details'),
      status,
      submittedAt: status === 'submitted' ? new Date() : security?.submittedAt,
      verifiedById: status === 'verified' ? scope.userId : security?.verifiedById,
      verifiedAt: status === 'verified' ? new Date() : security?.verifiedAt,
      approvedById: status === 'approved' ? scope.userId : security?.approvedById,
      approvedAt: status === 'approved' ? new Date() : security?.approvedAt,
      rejectionReason: status === 'rejected' ? value(formData, 'rejectionReason') : security?.rejectionReason,
    };
    if (security) await tx.chitSecurity.update({ where: { id: security.id }, data });
    else {
      await tx.chitSecurity.create({
        data: {
          tenantId: scope.tenantId,
          branchId: auction.chitGroup.branchId,
          chitGroupId: auction.chitGroupId,
          auctionId: auction.id,
          winnerMemberId: auction.winnerMemberId,
          ...data,
        },
      });
    }
    if (status === 'approved') {
      await tx.chitAuction.update({ where: { id: auction.id }, data: { payoutStatus: 'ready' } });
    }
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: `security_${status}`,
      entityType: 'chit_security',
      entityId: auction.id,
      newValue: data,
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function releasePrizePayout(auctionId: string, formData?: FormData) {
  const scope = await getWebChitScope();
  if (!canApproveChitSecurity(scope.role)) throw new Error('Forbidden');
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  const security = await prisma.chitSecurity.findFirst({ where: { auctionId: auction.id }, orderBy: { updatedAt: 'desc' } });
  assertCanReleasePrizePayout({
    auctionStatus: auction.status,
    payoutStatus: auction.payoutStatus,
    securityStatus: security?.status,
    winnerMemberId: auction.winnerMemberId,
    prizeAmount: auction.prizeAmount ? Number(auction.prizeAmount) : null,
  });

  await prisma.$transaction(async (tx) => {
    const result = await releaseChitPrizePayout(tx, {
      tenantId: scope.tenantId,
      appType: scope.appType,
      branchId: auction.chitGroup.branchId,
      auctionId: auction.id,
      amount: Number(auction.prizeAmount),
      periodNumber: auction.periodNumber,
      userId: scope.userId as string,
      paymentMode: formData ? value(formData, 'paymentMode') ?? 'cash' : 'cash',
      referenceNo: formData ? value(formData, 'referenceNo') : null,
      notes: formData ? value(formData, 'notes') : null,
    });
    await tx.chitAuction.update({ where: { id: auction.id }, data: { payoutStatus: 'paid', status: 'paid' } });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'release_payout',
      entityType: 'chit_auction',
      entityId: auction.id,
      newValue: result,
    });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function recordChitPayment(
  memberId: string,
  periodNumber: number,
  amount: number,
  paymentMode = 'cash',
  referenceNo?: string | null,
  notes?: string | null,
) {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) throw new Error('Forbidden');
  const sub = await prisma.chitSubscription.findFirst({
    where: { memberId, periodNumber, member: { chitGroup: scopedChitGroupWhere(scope) } },
    include: { member: { include: { chitGroup: { include: { branch: true } } } } },
  });
  if (!sub) throw new Error('Subscription not found or not in your tenant/branch');
  let receiptNo = '';
  await prisma.$transaction(async (tx) => {
    const result = await collectChitSubscriptionPayment(tx, {
      tenantId: scope.tenantId,
      appType: scope.appType,
      branchId: sub.member.chitGroup.branchId,
      branchCode: sub.member.chitGroup.branch?.code,
      subscriptionId: sub.id,
      currentPaidAmount: Number(sub.paidAmount),
      dueAmount: Number(sub.dueAmount),
      amount,
      mode: 'ADD_PAYMENT',
      paymentMode,
      referenceNo,
      notes,
      collectorId: scope.userId as string,
    });
    receiptNo = result.receiptNo;
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'chit_payment',
      entityType: 'chit_subscription',
      entityId: sub.id,
      newValue: result,
    });
  });

  revalidatePath(modulePath(scope.appType, `/chits/${sub.member.chitGroupId}`));
  return { receiptNo };
}

export async function openLiveRoom(auctionId: string, durationMinutes = 30, autoExtendSeconds = 0) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (auction.chitGroup.auctionType !== 'open_live') throw new Error('Live room is only available for open_live chits');
  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');

  await prisma.$transaction(async (tx) => {
    await closeRoomIfExpired(tx, auctionId);
    const fresh = await tx.chitAuction.findUnique({ where: { id: auctionId }, select: { roomStatus: true } });
    if (fresh && ['open', 'extended'].includes(fresh.roomStatus)) throw new Error('Room is already open');
    await openAuctionRoom(tx, { auctionId, durationMinutes, autoExtendSeconds });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'open_live_room',
      entityType: 'chit_auction',
      entityId: auctionId,
      newValue: { durationMinutes, autoExtendSeconds },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

export async function closeLiveRoom(auctionId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
  });
  if (!auction) throw new Error('Auction not found');
  await prisma.$transaction(async (tx) => {
    await closeAuctionRoom(tx, auctionId);
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'close_live_room',
      entityType: 'chit_auction',
      entityId: auctionId,
      newValue: { roomStatus: 'closed' },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

// Poll target for the web live auction room (2-3s interval). Lazily closes an
// expired room, then returns server-clock-driven room state.
export async function getLiveAuctionState(auctionId: string) {
  const scope = await getWebChitScope();
  const exists = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!exists) throw new Error('Auction not found');

  await prisma.$transaction(async (tx) => {
    await closeRoomIfExpired(tx, auctionId);
  });

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: {
      chitGroup: true,
      bids: {
        where: { status: { in: ['valid', 'winning'] } },
        include: { member: { include: { customer: { select: { name: true } } } } },
        orderBy: { bidTime: 'desc' },
      },
      attendance: true,
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
  });
  if (!auction) throw new Error('Auction not found');

  const now = new Date();
  const sealed = auction.chitGroup.auctionType === 'sealed' && auction.roomStatus !== 'closed';
  const bids = sealed
    ? []
    : auction.bids.map((bid) => ({
        id: bid.id,
        ticketNo: bid.member.ticketNo,
        memberName: bid.member.customer.name,
        bidAmount: Number(bid.bidAmount),
        bidDiscount: Number(bid.bidDiscount),
        bidTime: bid.bidTime.toISOString(),
        status: bid.status,
      }));
  const highestBid = bids.length
    ? bids.reduce((top, bid) => (bid.bidDiscount > top.bidDiscount ? bid : top), bids[0])
    : null;

  return {
    roomStatus: auction.roomStatus,
    auctionStatus: auction.status,
    serverTime: now.toISOString(),
    biddingClosesAt: auction.biddingClosesAt?.toISOString() ?? null,
    secondsRemaining: secondsRemaining(auction, now),
    bidCount: auction.bids.length,
    bids,
    highestBid,
    presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
    winner: auction.winnerMember
      ? { name: auction.winnerMember.customer.name, ticketNo: auction.winnerMember.ticketNo }
      : null,
  };
}

export async function markPaymentMissed(subscriptionId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const sub = await prisma.chitSubscription.findFirst({
    where: { id: subscriptionId, member: { chitGroup: scopedChitGroupWhere(scope) } },
    include: { member: true },
  });
  if (!sub) throw new Error('Subscription not found');
  if (sub.status === 'paid' || Number(sub.paidAmount) > 0) throw new Error('Cannot mark a paid/partial subscription as missed');

  await prisma.$transaction(async (tx) => {
    await tx.chitSubscription.update({ where: { id: subscriptionId }, data: { status: 'missed' } });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'mark_missed',
      entityType: 'chit_subscription',
      entityId: subscriptionId,
      newValue: { status: 'missed' },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${sub.member.chitGroupId}`));
}

export async function cancelChitGroup(id: string) {
  const { scope, group } = await loadScopedGroup(id);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (group.status === 'cancelled') throw new Error('Already cancelled');

  await prisma.$transaction(async (tx) => {
    await tx.chitGroup.update({ where: { id }, data: { status: 'cancelled', complianceStatus: 'suspended' } });
    await tx.chitAuction.updateMany({ where: { chitGroupId: id, status: 'pending' }, data: { status: 'cancelled' } });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'cancel',
      entityType: 'chit_group',
      entityId: id,
      newValue: { status: 'cancelled' },
    });
  });
  revalidatePath(modulePath(scope.appType, '/chits'));
  revalidatePath(modulePath(scope.appType, `/chits/${id}`));
}

export async function updateChitGroup(id: string, formData: FormData) {
  const { scope, group } = await loadScopedGroup(id);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (group.status === 'active' && scope.role === 'admin') {
    throw new Error('Only superadmin/developer can edit active compliance metadata');
  }

  const data = {
    name: value(formData, 'name') ?? group.name,
    commissionPct: numberValue(formData, 'commissionPct', Number(group.commissionPct)),
    foremanCommissionCapPct: numberValue(formData, 'foremanCommissionCapPct', group.foremanCommissionCapPct ? Number(group.foremanCommissionCapPct) : undefined),
    maxDiscountPct: numberValue(formData, 'maxDiscountPct', group.maxDiscountPct ? Number(group.maxDiscountPct) : undefined),
    registrationNo: value(formData, 'registrationNo') ?? group.registrationNo,
    registrarOffice: value(formData, 'registrarOffice') ?? group.registrarOffice,
    bylawNo: value(formData, 'bylawNo') ?? group.bylawNo,
    commencementCertificate: value(formData, 'commencementCertificate') ?? group.commencementCertificate,
    approvedBankName: value(formData, 'approvedBankName') ?? group.approvedBankName,
    approvedBankAccountNo: value(formData, 'approvedBankAccountNo') ?? group.approvedBankAccountNo,
    foremanName: value(formData, 'foremanName') ?? group.foremanName,
    remarks: value(formData, 'remarks') ?? group.remarks,
  };
  await prisma.$transaction(async (tx) => {
    await tx.chitGroup.update({ where: { id }, data });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'update',
      entityType: 'chit_group',
      entityId: id,
      newValue: data,
    });
  });
  revalidatePath(modulePath(scope.appType, '/chits'));
  revalidatePath(modulePath(scope.appType, `/chits/${id}`));
  redirect(modulePath(scope.appType, `/chits/${id}`));
}
