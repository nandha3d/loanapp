'use server';

import prisma from '@/lib/db';
import { modulePath } from '@/types/modules';
import { mkdir, writeFile } from 'fs/promises';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import path from 'path';
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
  isRoomOpen,
  openAuctionRoom,
  secondsRemaining,
} from '@/lib/chits/liveAuction';
import { syncRoom, ringBellManually, buildBellState } from '@/lib/chits/bell';
import { buildAuctionTimeline } from '@/lib/chits/timeline';
import { buildWinnerSummary } from '@/lib/chits/winnerSummary';
import { placeChitBid } from '@/lib/chits/bidService';
import { releaseChitPrizePayout } from '@/lib/chits/payout';
import { assertCanReleasePrizePayout } from '@/lib/chits/security';
import {
  assertValidCommissionPct,
  assertValidPrizeAmount,
  startingDiscountAmount,
  validateChitConfig,
  validateChitGroupActivation,
} from '@/lib/chits/validation';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  uploadBaseDir,
  validateFileBytes,
} from '@/lib/fileUpload';
import { generateCode } from '@/lib/utils';
import { parseFrequency, nextPeriodDate } from '@/lib/chits/frequency';

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

function scheduledDateTime(baseDate: Date, auctionTime?: string | null) {
  const scheduled = new Date(baseDate);
  if (auctionTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(auctionTime)) {
    const [hours, minutes] = auctionTime.split(':').map(Number);
    scheduled.setHours(hours, minutes, 0, 0);
  }
  return scheduled;
}

const SECURITY_DOCUMENT_FIELDS = [
  { key: 'guarantorPhoto', type: 'guarantor_photo', label: 'Guarantor photo' },
  { key: 'guarantorKyc', type: 'guarantor_kyc', label: 'Guarantor KYC' },
  { key: 'securityCheque', type: 'security_cheque', label: 'Security cheque' },
] as const;

async function saveChitDocumentFile(file: File, tenantId: string) {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: only JPEG, PNG, WebP, and PDF files are accepted`);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`${file.name}: file exceeds the 5 MB limit`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    throw new Error(`${file.name}: invalid file signature`);
  }
  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const uploadDir = path.join(uploadBaseDir(), tenantId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);
  return { url: `/api/files/${tenantId}/${safeName}`, fileName: file.name || safeName };
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
  const auctionTime = value(formData, 'auctionTime');
  const winnerInterestType = value(formData, 'winnerInterestType') ?? 'NONE';
  const winnerInterestValue = numberValue(formData, 'winnerInterestValue');
  const winnerInterestPeriods = numberValue(formData, 'winnerInterestPeriods');
  const roomAdmission = value(formData, 'roomAdmission') === 'approval' ? 'approval' : 'auto';
  const bellEnabled = value(formData, 'bellEnabled') !== 'false';
  const bellIntervalSeconds = numberValue(formData, 'bellIntervalSeconds', 60) ?? 60;
  const bellCount = numberValue(formData, 'bellCount', 3) ?? 3;
  const bellAutoClose = value(formData, 'bellAutoClose') !== 'false';
  validateChitConfig({
    auctionType: value(formData, 'auctionType') ?? 'open_manual',
    commissionBasis: value(formData, 'commissionBasis') ?? 'BID_DISCOUNT',
    dividendPolicy: value(formData, 'dividendPolicy') ?? 'ALL_MEMBERS',
    dividendDistribution: value(formData, 'dividendDistribution') ?? 'ADJUST_NEXT_DUE',
    tieBreakRule: value(formData, 'tieBreakRule') ?? 'EARLIEST_BID',
    minDiscountPct,
    maxDiscountPct,
    fixedDiscountPct: numberValue(formData, 'fixedDiscountPct'),
    auctionTime,
    winnerInterestType,
    winnerInterestValue,
    winnerInterestPeriods,
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
        frequencyUnit: value(formData, 'frequencyUnit'),
        frequencyInterval: numberValue(formData, 'frequencyInterval'),
        frequencyWeekdays: value(formData, 'frequencyWeekdays'),
        auctionMode: value(formData, 'auctionMode') ?? 'offline',
        auctionDay: numberValue(formData, 'auctionDay'),
        auctionTime,
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
        bidStartAtCommission: value(formData, 'bidStartAtCommission') !== 'false',
        fixedDiscountPct: numberValue(formData, 'fixedDiscountPct'),
        commissionBasis: value(formData, 'commissionBasis') ?? 'BID_DISCOUNT',
        gstPct: numberValue(formData, 'gstPct'),
        dividendPolicy: value(formData, 'dividendPolicy') ?? 'ALL_MEMBERS',
        dividendDistribution: value(formData, 'dividendDistribution') ?? 'ADJUST_NEXT_DUE',
        dividendRounding: numberValue(formData, 'dividendRounding', 0) ?? 0,
        bidIncrement: numberValue(formData, 'bidIncrement'),
        tieBreakRule: value(formData, 'tieBreakRule') ?? 'EARLIEST_BID',
        winnerInterestType,
        winnerInterestValue: winnerInterestType === 'NONE' ? null : winnerInterestValue,
        winnerInterestPeriods: winnerInterestType === 'NONE' ? null : winnerInterestPeriods,
        roomAdmission,
        bellEnabled,
        bellIntervalSeconds,
        bellCount,
        bellAutoClose,
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

  const freq = parseFrequency(group);
  await prisma.$transaction(async (tx) => {
    const existingSubscriptions = await tx.chitSubscription.count({
      where: { member: { chitGroupId: group.id } },
    });
    const existingAuctions = await tx.chitAuction.count({ where: { chitGroupId: group.id } });
    const periodCount = group.totalMembers;
    if (!existingSubscriptions) {
      for (let period = 1; period <= periodCount; period++) {
        const dueDate = nextPeriodDate(group.startDate, period, freq);
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
        const auctionDate = nextPeriodDate(group.startDate, period, freq);
        await tx.chitAuction.create({
          data: {
            chitGroupId: group.id,
            periodNumber: period,
            auctionDate,
            scheduledAt: scheduledDateTime(auctionDate, group.auctionTime),
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

export async function rescheduleAuction(auctionId: string, scheduledAtIso: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('Invalid schedule date/time');
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (!['pending', 'notice_sent'].includes(auction.status)) {
    throw new Error('Only pending or notice-sent auctions can be rescheduled');
  }

  await prisma.$transaction(async (tx) => {
    await tx.chitAuction.update({
      where: { id: auction.id },
      data: {
        scheduledAt,
        auctionDate: scheduledAt,
        reminder1DayAt: null,
        reminder1HourAt: null,
      },
    });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'reschedule_auction',
      entityType: 'chit_auction',
      entityId: auction.id,
      newValue: { scheduledAt: scheduledAt.toISOString() },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
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

  const bid = await prisma.$transaction(async (tx) => {
    return placeChitBid(tx, {
      auction,
      member,
      prizeAmount,
      remarks,
      source: 'tap',
      createdById: scope.userId || undefined,
      tenantId: scope.tenantId,
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  return bid;
}

export async function retractLiveMemberBid(auctionId: string, memberId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (auction.chitGroup.auctionType !== 'open_live') throw new Error('Retract is only available in live rooms');
  if (!['open', 'extended'].includes(auction.roomStatus)) throw new Error('Room is not open');
  const last = await prisma.chitBid.findFirst({
    where: {
      auctionId,
      memberId,
      status: 'valid',
      ...(auction.startedAt ? { bidTime: { gte: auction.startedAt } } : {}),
    },
    orderBy: { bidTime: 'desc' },
    select: { id: true },
  });
  if (!last) throw new Error('No valid member bid to retract');

  await prisma.$transaction(async (tx) => {
    await tx.chitBid.update({
      where: { id: last.id },
      data: { status: 'retracted', kind: 'retracted' },
    });
    await tx.chitAuctionEvent.create({
      data: {
        auctionId,
        type: 'pass',
        message: 'Bid retracted',
        memberId,
        createdById: scope.userId,
      },
    });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'retract_live_bid',
      entityType: 'chit_auction',
      entityId: auctionId,
      newValue: { memberId, bidId: last.id },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
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
  const requestedAction = value(formData, 'action');
  const status = requestedAction === 'verify'
    ? 'verified'
    : requestedAction === 'approve'
      ? 'approved'
      : requestedAction === 'reject'
        ? 'rejected'
        : requestedAction === 'documents'
          ? 'documents'
          : 'submitted';
  if ((status === 'approved' || status === 'rejected') && !canApproveChitSecurity(scope.role)) throw new Error('Forbidden');

  await prisma.$transaction(async (tx) => {
    const security = await tx.chitSecurity.findFirst({ where: { auctionId: auction.id } });
    const data: any = {
      securityType: value(formData, 'securityType') ?? security?.securityType ?? 'guarantor',
      securityValue: numberValue(formData, 'securityValue'),
      guarantorName: value(formData, 'guarantorName'),
      guarantorPhone: value(formData, 'guarantorPhone'),
      details: value(formData, 'details'),
      status: status === 'documents' ? security?.status ?? 'submitted' : status,
      submittedAt: status === 'submitted' ? new Date() : security?.submittedAt,
      verifiedById: status === 'verified' ? scope.userId : security?.verifiedById,
      verifiedAt: status === 'verified' ? new Date() : security?.verifiedAt,
      approvedById: status === 'approved' ? scope.userId : security?.approvedById,
      approvedAt: status === 'approved' ? new Date() : security?.approvedAt,
      rejectionReason: status === 'rejected' ? value(formData, 'rejectionReason') : security?.rejectionReason,
    };
    const savedSecurity = security
      ? await tx.chitSecurity.update({ where: { id: security.id }, data })
      : await tx.chitSecurity.create({
        data: {
          tenantId: scope.tenantId,
          branchId: auction.chitGroup.branchId,
          chitGroupId: auction.chitGroupId,
          auctionId: auction.id,
          winnerMemberId: auction.winnerMemberId,
          ...data,
        },
      });
    for (const spec of SECURITY_DOCUMENT_FIELDS) {
      const file = formData.get(spec.key);
      if (!(file instanceof File) || file.size <= 0) continue;
      const saved = await saveChitDocumentFile(file, scope.tenantId);
      await tx.chitDocument.create({
        data: {
          tenantId: scope.tenantId,
          branchId: auction.chitGroup.branchId,
          appType: scope.appType,
          entityType: 'chit_security',
          entityId: savedSecurity.id,
          documentType: spec.type,
          fileName: saved.fileName,
          fileUrl: saved.url,
          mimeType: file.type || null,
          sizeBytes: file.size,
          status: 'pending',
          uploadedById: scope.userId,
        },
      });
    }
    if (status === 'approved') {
      await tx.chitAuction.update({ where: { id: auction.id }, data: { payoutStatus: 'ready' } });
    }
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: status === 'documents' ? 'security_documents' : `security_${status}`,
      entityType: 'chit_security',
      entityId: savedSecurity.id,
      newValue: data,
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
}

export async function reviewChitSecurityDocument(auctionId: string, documentId: string, action: 'verify' | 'approve' | 'reject') {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const status = action === 'verify' ? 'verified' : action === 'approve' ? 'approved' : 'rejected';
  if ((status === 'approved' || status === 'rejected') && !canApproveChitSecurity(scope.role)) throw new Error('Forbidden');
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  const security = await prisma.chitSecurity.findFirst({ where: { auctionId: auction.id }, orderBy: { updatedAt: 'desc' } });
  if (!security) throw new Error('Security record is required before reviewing documents');
  const document = await prisma.chitDocument.findFirst({
    where: {
      id: documentId,
      tenantId: scope.tenantId,
      appType: scope.appType,
      entityType: 'chit_security',
      entityId: security.id,
    },
  });
  if (!document) throw new Error('Security document not found');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.chitDocument.update({
      where: { id: document.id },
      data: { status },
    });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: `security_document_${status}`,
      entityType: 'chit_security',
      entityId: security.id,
      newValue: { documentId: updated.id, documentType: updated.documentType, status },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
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
    await syncRoom(tx, auctionId);
    const fresh = await tx.chitAuction.findUnique({ where: { id: auctionId }, select: { roomStatus: true } });
    if (fresh && ['open', 'extended'].includes(fresh.roomStatus)) throw new Error('Room is already open');
    await openAuctionRoom(tx, { auctionId, durationMinutes, autoExtendSeconds, openedById: scope.userId });
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
    await closeAuctionRoom(tx, auctionId, { closedById: scope.userId });
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

// Manual bell ring — staff-only. Re-anchors the automatic bell countdown so
// the next automatic ring lands exactly one interval after this one.
export async function ringLiveBell(auctionId: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
  });
  if (!auction) throw new Error('Auction not found');
  await prisma.$transaction(async (tx) => {
    await syncRoom(tx, auctionId);
    await ringBellManually(tx, auctionId, scope.userId ?? null);
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}

// Poll target for the web live auction room (2-3s interval). Lazily evaluates
// bells + closes an expired room, then returns server-clock-driven room state.
// Full post-win summary (staff audience) — prize/discount/commission/GST/
// dividend breakdown plus every member's dividend and, for cash-payout
// groups, the receipt number. Null while the auction isn't confirmed yet.
export async function getAuctionWinnerSummary(auctionId: string) {
  const scope = await getWebChitScope();
  const exists = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!exists) throw new Error('Auction not found');
  return buildWinnerSummary(auctionId, { audience: 'staff' });
}

// Full chronological auction activity feed — staff audience. Not part of the
// hot 1.5-3s poll loop; called on-demand when the "Auction activity" panel
// is expanded, and on a slower refresh interval while it stays open.
export async function getAuctionTimeline(auctionId: string) {
  const scope = await getWebChitScope();
  const exists = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!exists) throw new Error('Auction not found');
  const timeline = await buildAuctionTimeline(auctionId, { audience: 'staff' });
  if (!timeline) throw new Error('Auction not found');
  return timeline;
}

export async function getLiveAuctionState(auctionId: string) {
  const scope = await getWebChitScope();
  const exists = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!exists) throw new Error('Auction not found');

  await prisma.$transaction(async (tx) => {
    await syncRoom(tx, auctionId);
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
        memberId: bid.memberId,
        ticketNo: bid.member.ticketNo,
        memberName: bid.member.customer.name,
        bidAmount: Number(bid.bidAmount),
        prizeAmount: Number(bid.bidAmount),
        bidDiscount: Number(bid.bidDiscount),
        discountAmount: Number(bid.bidDiscount),
        bidTime: bid.bidTime.toISOString(),
        createdAt: bid.bidTime.toISOString(),
        source: bid.source ?? 'tap',
        status: bid.status,
        kind: bid.status === 'retracted' ? 'retracted' : 'bid',
      }));
  const highestBid = bids.length
    ? bids.reduce((top, bid) => (bid.bidDiscount > top.bidDiscount ? bid : top), bids[0])
    : null;
  const minStep = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
  const chitValueNum = Number(auction.chitGroup.chitValue);
  // Bug fix (doc 13): with no bids yet, the floor must come from the group's
  // discount floor (min discount % / commission %), matching the customer app
  // and the hard validator — not chitValue-minus-increment, which let staff
  // web display/accept an effective ₹(increment) discount on the opening bid.
  const minNextPrize = highestBid
    ? Math.max(1, highestBid.bidAmount - minStep)
    : Math.max(
        1,
        chitValueNum -
          startingDiscountAmount(chitValueNum, {
            minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
            bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
            commissionPct: auction.chitGroup.commissionPct != null ? Number(auction.chitGroup.commissionPct) : null,
          }),
      );
  const allBids = bids.slice(0, 200);
  const memberBids = allBids.reduce<Record<string, typeof allBids>>((acc, bid) => {
    acc[bid.memberId] = acc[bid.memberId] ?? [];
    acc[bid.memberId].push(bid);
    return acc;
  }, {});

  // Chat + waiting room piggyback on the hot poll (web is staff-only, so all
  // visibilities are returned). Waiting = joiners awaiting an admit/deny when
  // the group's roomAdmission is 'approval'.
  const messageRows = await prisma.chitRoomMessage.findMany({
    where: { auctionId: auction.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, senderName: true, visibility: true, body: true, createdAt: true },
  });
  const latestMessages = messageRows.reverse().map((m) => ({
    id: m.id,
    senderName: m.senderName,
    visibility: m.visibility,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
  const waitingRows = await prisma.chitAuctionAttendance.findMany({
    where: { auctionId: auction.id, admissionStatus: 'waiting' },
    select: { memberId: true, member: { select: { customer: { select: { name: true } } } } },
  });
  const waiting = waitingRows.map((w) => ({ memberId: w.memberId, name: w.member?.customer?.name ?? '—' }));
  const bell = await buildBellState(auction);

  return {
    roomStatus: auction.roomStatus,
    auctionStatus: auction.status,
    serverTime: now.toISOString(),
    biddingClosesAt: auction.biddingClosesAt?.toISOString() ?? null,
    secondsRemaining: secondsRemaining(auction, now),
    bell,
    bidCount: auction.bids.length,
    bids,
    recentBids: bids.slice(0, 20),
    allBids,
    memberBids,
    highestBid,
    currentBest: highestBid
      ? { memberId: highestBid.memberId, prizeAmount: highestBid.bidAmount, discountAmount: highestBid.bidDiscount }
      : null,
    minNextPrize,
    presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
    roomAdmission: auction.chitGroup.roomAdmission,
    latestMessages,
    waiting,
    winner: auction.winnerMember
      ? { name: auction.winnerMember.customer.name, ticketNo: auction.winnerMember.ticketNo }
      : null,
  };
}

/** Post a live-room chat message. 'organizer' visibility = private to staff. */
export async function postRoomMessage(auctionId: string, body: string, visibility: 'public' | 'organizer' = 'public') {
  const scope = await getWebChitScope();
  const trimmed = String(body ?? '').trim();
  if (!trimmed) throw new Error('Message body required');
  if (trimmed.length > 500) throw new Error('Message too long (max 500 characters)');

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!auction) throw new Error('Auction not found');

  const sender = scope.userId
    ? await prisma.user.findUnique({
        where: { id: scope.userId },
        select: { name: true, username: true },
      })
    : null;
  await prisma.chitRoomMessage.create({
    data: {
      tenantId: scope.tenantId,
      auctionId,
      senderUserId: scope.userId,
      senderName: sender?.name || sender?.username || 'Staff',
      visibility: visibility === 'organizer' ? 'organizer' : 'public',
      body: trimmed,
    },
  });
}

/** Organizer decision on a waiting-room member: admit or deny. */
export async function decideRoomAdmission(auctionId: string, memberId: string, decision: 'admit' | 'deny') {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
    select: { id: true },
  });
  if (!auction) throw new Error('Auction not found');

  const attendance = await prisma.chitAuctionAttendance.findUnique({
    where: { auctionId_memberId: { auctionId, memberId } },
    select: { id: true },
  });
  if (!attendance) throw new Error('Member has not joined this room');

  const admissionStatus = decision === 'deny' ? 'denied' : 'admitted';
  await prisma.chitAuctionAttendance.update({
    where: { id: attendance.id },
    data: { admissionStatus, markedById: scope.userId },
  });
  await prisma.chitAuctionEvent.create({
    data: {
      auctionId,
      type: 'announce',
      memberId,
      message: admissionStatus === 'admitted' ? 'Member admitted to room' : 'Member denied entry',
      createdById: scope.userId,
    },
  });
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
    minDiscountPct: numberValue(formData, 'minDiscountPct', group.minDiscountPct ? Number(group.minDiscountPct) : undefined),
    bidStartAtCommission: value(formData, 'bidStartAtCommission') != null ? value(formData, 'bidStartAtCommission') === 'true' : group.bidStartAtCommission,
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
