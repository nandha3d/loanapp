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
import {
  approveChitPaymentIntent,
  listChitPaymentIntentsForStaff,
  rejectChitPaymentIntent,
} from '@/lib/chits/paymentIntents';
import { getTopBids, getWinningBid, rescheduleAuctionInTx } from '@/lib/chits/auction';
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
  computeAutomatedBidBounds,
  startingDiscountAmount,
  validateChitConfig,
  validateChitEngineConfig,
  validateChitGroupActivation,
} from '@/lib/chits/validation';
import {
  isChitEngineType,
  isBiddingEnabledForPeriod,
  mapBiddingModeToAuctionType,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
  serializeChitEngineConfig,
} from '@/lib/chits/engineTypes';
import { assertChitEngineTypeEnabled } from '@/lib/chits/settings';
import { calculateReserveFloor } from '@/lib/chits/engineCalculator';
import {
  simulateChitLifecycle,
  type ChitSimulationInput,
  type ChitSimulationResult,
} from '@/lib/chits/simulator';
import {
  activateChitGroupInTx,
  assertMemberSubstitutionAllowed,
  confirmMultiDivisionAuctionInTx,
  findActiveGuaranteeLock,
  resolveNonAuctionPeriodInTx,
} from '@/lib/chits/groupService';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  storeTenantUpload,
  validateFileBytes,
} from '@/lib/fileUpload';
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
  const stored = await storeTenantUpload({
    tenantId,
    mimeType: file.type,
    buffer,
    prefix: 'chit',
  });
  return { url: stored.url, fileName: file.name || stored.fileName };
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

  const rawAuctionType = value(formData, 'auctionType');
  const rawEngineType =
    value(formData, 'chitEngineType') ??
    (rawAuctionType === 'lottery'
      ? 'PURE_LOTTERY'
      : rawAuctionType === 'fixed_rotation'
        ? 'FIXED_ROTATION'
        : 'AUCTION_STANDARD');
  const chitEngineType = await assertChitEngineTypeEnabled(scope.tenantId, rawEngineType);
  const rawEngineConfigStr = value(formData, 'engineConfig');
  const parsedEngineConfig = parseChitEngineConfig(rawEngineConfigStr, chitEngineType);
  parsedEngineConfig.foremanCompensation.commissionPct = commissionPct;
  if (minDiscountPct != null) parsedEngineConfig.discountRules.minDiscountPct = minDiscountPct;
  if (maxDiscountPct !== undefined) parsedEngineConfig.discountRules.maxDiscountPct = maxDiscountPct;

  const auctionType =
    value(formData, 'auctionType') ??
    mapBiddingModeToAuctionType(chitEngineType, parsedEngineConfig.biddingMode);
  const dividendPolicy = value(formData, 'dividendPolicy') ?? 'ALL_MEMBERS';
  const dividendDistribution =
    value(formData, 'dividendDistribution') ??
    (parsedEngineConfig.dividendDistributionMode === 'DEFERRED_BONUS_POOL'
      ? 'DEFERRED_BONUS_POOL'
      : parsedEngineConfig.dividendDistributionMode === 'NONE'
        ? 'NONE'
        : 'ADJUST_NEXT_DUE');

  validateChitEngineConfig(chitEngineType, parsedEngineConfig, {
    totalMembers,
    requireScheduleRows: false,
  });
  validateChitConfig({
    auctionType,
    commissionBasis: value(formData, 'commissionBasis') ?? 'BID_DISCOUNT',
    dividendPolicy,
    dividendDistribution,
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
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
        },
        select: { id: true },
      })
    : [];
  if (validCustomers.length !== memberIds.length) {
    throw new Error('One or more chit members are invalid or inactive for this tenant/app/branch.');
  }

  const group = await prisma.$transaction(async (tx) => {
    const resolvedBranchId =
      scope.branchId ??
      (await tx.branch
        .findMany({
          where: { tenantId: scope.tenantId, status: 'active' },
          select: { id: true },
          take: 2,
        })
        .then((rows) => (rows.length === 1 ? rows[0].id : null)));
    const existingCount = await tx.chitGroup.count({ where: { tenantId: scope.tenantId } });
    const groupCode = generateCode('CF', existingCount + 1, 5);
    const created = await tx.chitGroup.create({
      data: {
        tenantId: scope.tenantId,
        branchId: resolvedBranchId || undefined,
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
        chitEngineType,
        engineConfig: serializeChitEngineConfig(parsedEngineConfig),
        auctionType,
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
        dividendPolicy,
        dividendDistribution,
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

export async function activateChitGroup(groupId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { scope, group } = await loadScopedGroup(groupId);
    assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
    if (group.status === 'active') {
      return { ok: false, error: 'Chit group is already active' };
    }

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
    if (invalidShareCount) {
      return { ok: false, error: 'Each ticket share total must equal 1.00' };
    }

    const rawPendingAgreements = members.filter((member) => !['signed', 'verified'].includes(member.agreementStatus)).length;

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
      pendingAgreementCount: group.chitType === 'registered' ? rawPendingAgreements : 0,
      hasForemanTicket: group.hasForemanTicket,
      foremanTicketCount: members.filter((member) => member.isForemanTicket).length,
    });

    await prisma.$transaction(async (tx) => {
      if (group.chitType !== 'registered' && rawPendingAgreements > 0) {
        await tx.chitMember.updateMany({
          where: {
            chitGroupId: group.id,
            agreementStatus: { notIn: ['signed', 'verified'] },
          },
          data: {
            agreementStatus: 'signed',
            agreementSignedAt: new Date(),
          },
        });
      }

      await activateChitGroupInTx(tx, {
        scope,
        group,
        members,
      });

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
    if (group.groupCode) {
      revalidatePath(modulePath(scope.appType, `/chits/${group.groupCode}`));
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to activate chit group' };
  }
}

export async function updateChitMemberDetails(memberId: string, formData: FormData) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const member = await prisma.chitMember.findFirst({
    where: { id: memberId, chitGroup: scopedChitGroupWhere(scope) },
    include: { chitGroup: true },
  });
  if (!member) throw new Error('Chit member not found');

  const nextSubscriberStatus = value(formData, 'subscriberStatus') ?? member.subscriberStatus;
  if (nextSubscriberStatus === 'substituted' && member.subscriberStatus !== 'substituted') {
    await assertMemberSubstitutionAllowed(prisma, { group: member.chitGroup });
  }

  const has = (k: string) => formData.has(k);
  const data = {
    // Ticket no is auto-assigned at enrollment; preserve omitted fields on 1-field updates (sign/verify).
    ...(has('ticketNo') ? { ticketNo: value(formData, 'ticketNo') ?? member.ticketNo } : {}),
    ...(has('fractionNo') ? { fractionNo: value(formData, 'fractionNo') } : {}),
    ...(has('ticketShare') ? { ticketShare: numberValue(formData, 'ticketShare', Number(member.ticketShare)) } : {}),
    ...(has('nomineeName') ? { nomineeName: value(formData, 'nomineeName') } : {}),
    ...(has('nomineeRelation') ? { nomineeRelation: value(formData, 'nomineeRelation') } : {}),
    ...(has('nomineePhone') ? { nomineePhone: value(formData, 'nomineePhone') } : {}),
    ...(has('introducedBy') ? { introducedBy: value(formData, 'introducedBy') } : {}),
    agreementStatus: value(formData, 'agreementStatus') ?? member.agreementStatus,
    subscriberStatus: nextSubscriberStatus,
    ...(has('isForemanTicket') ? { isForemanTicket: value(formData, 'isForemanTicket') === 'true' } : {}),
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

type ChitActionResult<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string };

async function wrapChitAction<T>(fn: () => Promise<T>): Promise<ChitActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, ...(data as object) } as ChitActionResult<T>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed';
    return { ok: false, error: msg };
  }
}

export async function markAuctionNoticeSent(auctionId: string) {
  return wrapChitAction(async () => {
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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
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
    await rescheduleAuctionInTx(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      auctionId: auction.id,
      scheduledAt,
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
}

export async function markAuctionAttendance(auctionId: string, memberId: string, status = 'present', proxyName?: string | null) {
  return wrapChitAction(async () => {
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
        markedVia: 'staff',
      },
      update: { status, proxyName: proxyName || null, markedById: scope.userId || undefined, markedAt: new Date(), markedVia: 'staff' },
    });
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

export async function addAuctionBid(
  auctionId: string,
  memberId: string,
  prizeAmount: number,
  remarks?: string | null,
  opts?: { source?: 'tap' | 'voice' | 'remote'; transcript?: string | null; audioDocumentId?: string | null },
) {
  return wrapChitAction(async () => {
    const scope = await getWebChitScope();
    assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
      include: { chitGroup: true },
    });
    if (!auction) throw new Error('Auction not found');
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');
    if (!isBiddingEnabledForPeriod(auction.chitGroup, auction.periodNumber)) {
      throw new Error('This chit cycle uses a draw or fixed allocation — bids are not accepted.');
    }
    const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: auction.chitGroupId } });
    if (!member) throw new Error('Member not found in this chit group');

    const bid = await prisma.$transaction(async (tx) => {
      return placeChitBid(tx, {
        auction,
        member,
        prizeAmount,
        remarks,
        source: opts?.source ?? 'tap',
        transcript: opts?.transcript ?? null,
        audioDocumentId: opts?.audioDocumentId ?? null,
        createdById: scope.userId || undefined,
        tenantId: scope.tenantId,
      });
    });
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    // Convert Decimal columns to plain numbers before crossing the Server Action boundary
    // so React Flight serialization never throws Error #441 in production.
    return {
      bid: {
        id: bid.id,
        memberId: bid.memberId,
        bidAmount: Number(bid.bidAmount),
        bidDiscount: Number(bid.bidDiscount),
        status: bid.status,
      },
    };
  });
}

export async function retractLiveMemberBid(auctionId: string, memberId: string) {
  return wrapChitAction(async () => {
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
    return {};
  });
}

export async function confirmAuction(auctionId: string, winningBidId?: string | null, minutesText?: string | null) {
  return wrapChitAction(async () => {
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

    const engineType = resolveEngineTypeFromGroup(auction.chitGroup);
    if (engineType === 'AUCTION_MULTI_DIVISION' && !winningBidId) {
      await prisma.$transaction(async (tx) => {
        await confirmMultiDivisionAuctionInTx(tx, {
          scope,
          auction,
          group: auction.chitGroup,
          branchCode: auction.chitGroup.branch?.code,
          bids: auction.bids,
          presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
          minutesText,
        });
      });
      revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
      revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
      return {};
    }

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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

// Resolves a lottery or fixed_rotation period without bids: lottery uses the audited
// random draw; fixed_rotation takes the lowest unprized ticket. Creates a synthetic
// winning bid at the group's fixed discount so downstream flows match auctions.
export async function drawAuctionWinner(
  auctionId: string,
  opts?: { selectedMemberId?: string | null; consensusReason?: string | null; goldRatePerGram?: number | null },
) {
  return wrapChitAction(async () => {
    const scope = await getWebChitScope();
    assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
      include: { chitGroup: { include: { branch: true } }, attendance: true },
    });
    if (!auction) throw new Error('Auction not found');
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');

    await prisma.$transaction(async (tx) => {
      await resolveNonAuctionPeriodInTx(tx, {
        scope,
        auction,
        group: auction.chitGroup,
        branchCode: auction.chitGroup.branch?.code,
        presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
        selectedMemberId: opts?.selectedMemberId ?? null,
        consensusReason: opts?.consensusReason ?? null,
        goldRatePerGram: opts?.goldRatePerGram ?? null,
      });
    });
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

export async function recordAuctionWinner(auctionId: string, winnerMemberId: string, prizeAmount: number) {
  const bidRes = await addAuctionBid(auctionId, winnerMemberId, prizeAmount, 'Recorded from legacy winner action');
  if (!bidRes.ok) throw new Error(bidRes.error);
  const confirmRes = await confirmAuction(auctionId, bidRes.bid.id);
  if (!confirmRes.ok) throw new Error(confirmRes.error);
}

export async function submitChitSecurity(auctionId: string, formData: FormData) {
  return wrapChitAction(async () => {
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

    const guarantorMemberId = value(formData, 'guarantorMemberId');
    if (guarantorMemberId) {
      if (guarantorMemberId === auction.winnerMemberId) {
        throw new Error('Winner cannot stand as their own internal guarantor');
      }
      const gMem = await prisma.chitMember.findFirst({
        where: { id: guarantorMemberId, chitGroupId: auction.chitGroupId },
        select: { id: true },
      });
      if (!gMem) throw new Error('Selected guarantor member does not belong to this chit group');
    }

    await prisma.$transaction(async (tx) => {
      const security = await tx.chitSecurity.findFirst({ where: { auctionId: auction.id } });
      // Preserve existing security fields when partial actions (reject / upload documents) run.
      const data: any = {
        securityType: formData.has('securityType')
          ? value(formData, 'securityType') ?? security?.securityType ?? 'guarantor'
          : security?.securityType ?? 'guarantor',
        ...(formData.has('securityValue') ? { securityValue: numberValue(formData, 'securityValue') } : {}),
        ...(formData.has('guarantorMemberId') ? { guarantorMemberId: guarantorMemberId ?? null } : {}),
        ...(formData.has('guarantorName') ? { guarantorName: value(formData, 'guarantorName') } : {}),
        ...(formData.has('guarantorPhone') ? { guarantorPhone: value(formData, 'guarantorPhone') } : {}),
        ...(formData.has('details') ? { details: value(formData, 'details') } : {}),
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
    return {};
  });
}

export async function reviewChitSecurityDocument(auctionId: string, documentId: string, action: 'verify' | 'approve' | 'reject') {
  return wrapChitAction(async () => {
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
    return {};
  });
}

export async function releasePrizePayout(auctionId: string, formData?: FormData) {
  return wrapChitAction(async () => {
    const scope = await getWebChitScope();
    if (!canApproveChitSecurity(scope.role)) throw new Error('Forbidden');
    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
      include: { chitGroup: true },
    });
    if (!auction) throw new Error('Auction not found');
    const security = await prisma.chitSecurity.findFirst({ where: { auctionId: auction.id }, orderBy: { updatedAt: 'desc' } });
    const activeGuaranteeLock = auction.winnerMemberId
      ? await findActiveGuaranteeLock(prisma, {
          chitGroupId: auction.chitGroupId,
          memberId: auction.winnerMemberId,
        })
      : null;
    assertCanReleasePrizePayout({
      auctionStatus: auction.status,
      payoutStatus: auction.payoutStatus,
      securityStatus: security?.status,
      winnerMemberId: auction.winnerMemberId,
      prizeAmount: auction.prizeAmount ? Number(auction.prizeAmount) : null,
      activeGuaranteeLock,
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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

export async function recordChitPayment(
  memberId: string,
  periodNumber: number,
  amount: number,
  paymentMode = 'cash',
  referenceNo?: string | null,
  notes?: string | null,
  goldRatePerGram?: number | null,
) {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) throw new Error('Forbidden');
  const sub = await prisma.chitSubscription.findFirst({
    where: { memberId, periodNumber, member: { chitGroup: scopedChitGroupWhere(scope) } },
    include: { member: { include: { chitGroup: { include: { branch: true } } } } },
  });
  if (!sub) throw new Error('Subscription not found or not in your tenant/branch');
  const engineType = resolveEngineTypeFromGroup(sub.member.chitGroup);
  const engineCfg = parseChitEngineConfig(sub.member.chitGroup.engineConfig, engineType);
  const effectiveGoldRate =
    goldRatePerGram && goldRatePerGram > 0
      ? goldRatePerGram
      : engineCfg.goldScheme?.defaultGoldRatePerGram ?? null;
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
      isGoldWeightEngine: engineType === 'GOLD_WEIGHT_ACCUMULATION',
      goldRatePerGram: effectiveGoldRate,
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
  return wrapChitAction(async () => {
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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

export async function closeLiveRoom(auctionId: string) {
  return wrapChitAction(async () => {
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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
}

// Manual bell ring — staff-only. Re-anchors the automatic bell countdown so
// the next automatic ring lands exactly one interval after this one.
export async function ringLiveBell(auctionId: string) {
  return wrapChitAction(async () => {
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
    revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}/auctions/${auction.id}`));
    return {};
  });
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
  const chitValueNum = Number(auction.chitGroup.chitValue);
  const engineType = resolveEngineTypeFromGroup(auction.chitGroup);
  const engineCfg = parseChitEngineConfig(auction.chitGroup.engineConfig, engineType);
  const groupIncrement = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
  const engineIncrement =
    engineCfg.discountRules.bidIncrementMultiple > 0 ? engineCfg.discountRules.bidIncrementMultiple : 0;
  const minStep = groupIncrement > 0 ? groupIncrement : engineIncrement;
  const reserveFloorPct =
    engineType === 'AUCTION_RESERVE_PRICE' && engineCfg.discountRules.reservePriceStepPct > 0
      ? calculateReserveFloor({
          chitValue: chitValueNum,
          totalPeriods: auction.chitGroup.totalMembers,
          periodNumber: auction.periodNumber,
          reservePriceStepPct: engineCfg.discountRules.reservePriceStepPct,
          maxDiscountPct: engineCfg.discountRules.uncapped
            ? null
            : auction.chitGroup.maxDiscountPct != null
              ? Number(auction.chitGroup.maxDiscountPct)
              : null,
        }).reserveFloorPct
      : null;
  const bidBounds = computeAutomatedBidBounds({
    chitValue: chitValueNum,
    maxDiscountPct: auction.chitGroup.maxDiscountPct != null ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: auction.chitGroup.commissionPct != null ? Number(auction.chitGroup.commissionPct) : null,
    bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
    reserveFloorPct,
    uncapped: engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineCfg.discountRules.uncapped,
    bidIncrement: minStep,
    currentHighestDiscount: highestBid?.bidDiscount ?? 0,
    auctionType: auction.chitGroup.auctionType,
  });
  const minNextPrize = bidBounds.nextValidPrize;
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
    take: 50,
    select: {
      id: true,
      senderName: true,
      visibility: true,
      messageType: true,
      body: true,
      audioUrl: true,
      audioDurationSec: true,
      createdAt: true,
    },
  });
  const latestMessages = messageRows.reverse().map((m) => ({
    id: m.id,
    senderName: m.senderName,
    visibility: m.visibility,
    messageType: m.messageType,
    body: m.body,
    audioUrl: m.audioUrl,
    audioDurationSec: m.audioDurationSec,
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
    bidBounds,
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
  return wrapChitAction(async () => {
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
        messageType: 'text',
        body: trimmed,
      },
    });
    return {};
  });
}

/** Upload and post an instant live-room voice note (up to 1 MB audio) with optional speech transcript. */
export async function postRoomVoiceMessage(auctionId: string, formData: FormData) {
  return wrapChitAction(async () => {
    const scope = await getWebChitScope();
    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
      select: { id: true },
    });
    if (!auction) throw new Error('Auction not found');

    const audio = formData.get('audio');
    if (!(audio instanceof File) || audio.size <= 0) {
      throw new Error('Voice clip is required');
    }
    const rawMime = (audio.type || 'audio/webm').split(';')[0].trim().toLowerCase();
    const { isAudioMime, maxUploadSizeFor, detectMimeTypeFromBytes } = await import('@/lib/fileUpload');
    const buffer = Buffer.from(await audio.arrayBuffer());
    let effectiveMime = isAudioMime(rawMime) && ALLOWED_UPLOAD_MIME_TYPES.includes(rawMime)
      ? rawMime
      : detectMimeTypeFromBytes(buffer) ?? '';
    if (!effectiveMime || !isAudioMime(effectiveMime) || !ALLOWED_UPLOAD_MIME_TYPES.includes(effectiveMime)) {
      throw new Error('Unsupported voice audio format');
    }
    if (buffer.byteLength > maxUploadSizeFor(effectiveMime)) {
      throw new Error('Voice clip exceeds 1 MB limit');
    }
    const stored = await storeTenantUpload({
      tenantId: scope.tenantId,
      mimeType: effectiveMime,
      buffer,
      prefix: 'voice',
    });

    const transcript = value(formData, 'transcript') ?? '';
    const visibility = value(formData, 'visibility') === 'organizer' ? 'organizer' : 'public';
    const durationSecRaw = numberValue(formData, 'durationSec');
    const audioDurationSec =
      durationSecRaw && durationSecRaw > 0 ? Math.min(300, Math.round(durationSecRaw)) : null;

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
        visibility,
        messageType: 'voice',
        body: transcript ? transcript.slice(0, 500) : '🎤 Voice message',
        audioUrl: stored.url,
        audioDurationSec,
      },
    });
    return {};
  });
}

/** Organizer decision on a waiting-room member: admit or deny. */
export async function decideRoomAdmission(auctionId: string, memberId: string, decision: 'admit' | 'deny') {
  return wrapChitAction(async () => {
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
    return {};
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
    await tx.chitGroup.update({ where: { id: group.id }, data: { status: 'cancelled', complianceStatus: 'suspended' } });
    await tx.chitAuction.updateMany({ where: { chitGroupId: group.id, status: 'pending' }, data: { status: 'cancelled' } });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'cancel',
      entityType: 'chit_group',
      entityId: group.id,
      newValue: { status: 'cancelled' },
    });
  });
  revalidatePath(modulePath(scope.appType, '/chits'));
  revalidatePath(modulePath(scope.appType, `/chits/${group.groupCode ?? group.id}`));
}

export async function updateChitGroup(id: string, formData: FormData) {
  const { scope, group } = await loadScopedGroup(id);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (group.status === 'active' && scope.role === 'admin') {
    throw new Error('Only superadmin/developer can edit active compliance metadata');
  }

  const nextCommissionPct =
    numberValue(formData, 'commissionPct', Number(group.commissionPct)) ?? Number(group.commissionPct);
  const rawEngineConfig = value(formData, 'engineConfig');
  let validatedEngineConfig: string | undefined;
  if (group.status === 'draft' && (rawEngineConfig || formData.has('commissionPct'))) {
    const engineType = resolveEngineTypeFromGroup(group);
    const parsedCfg = parseChitEngineConfig(rawEngineConfig || group.engineConfig, engineType);
    if (formData.has('commissionPct')) {
      parsedCfg.foremanCompensation.commissionPct = nextCommissionPct;
    }
    if (rawEngineConfig) {
      validateChitEngineConfig(engineType, parsedCfg, {
        totalMembers: group.totalMembers,
        requireScheduleRows: false,
      });
    }
    validatedEngineConfig = serializeChitEngineConfig(parsedCfg);
  }

  const data = {
    name: value(formData, 'name') ?? group.name,
    commissionPct: nextCommissionPct,
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
    ...(validatedEngineConfig !== undefined ? { engineConfig: validatedEngineConfig } : {}),
  };
  await prisma.$transaction(async (tx) => {
    await tx.chitGroup.update({ where: { id: group.id }, data });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'update',
      entityType: 'chit_group',
      entityId: group.id,
      newValue: data,
    });
  });
  revalidatePath(modulePath(scope.appType, '/chits'));
  revalidatePath(modulePath(scope.appType, `/chits/${group.groupCode ?? group.id}`));
  redirect(modulePath(scope.appType, `/chits/${group.groupCode ?? group.id}`));
}

// ─── Doc 19: customer payment proof queue ────────────────────────────

export async function listChitPaymentIntentsQueue(status: string | null = 'pending', chitGroupId?: string | null) {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) throw new Error('Forbidden');
  return listChitPaymentIntentsForStaff({
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    status,
    chitGroupId: chitGroupId || null,
  });
}

export async function approveChitPaymentIntentAction(intentId: string, confirmedAmount: number) {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) throw new Error('Forbidden');
  if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) throw new Error('Confirmed amount must be positive');

  const intent = await prisma.chitPaymentIntent.findFirst({ where: { id: intentId, tenantId: scope.tenantId } });
  if (!intent) throw new Error('Payment intent not found');
  const member = await prisma.chitMember.findFirst({
    where: { id: intent.memberId, chitGroup: scopedChitGroupWhere(scope) },
    select: { chitGroupId: true, chitGroup: { select: { branch: { select: { code: true } } } } },
  });
  if (!member) throw new Error('Payment intent not found in active branch scope');

  const result = await approveChitPaymentIntent({
    tenantId: scope.tenantId,
    appType: scope.appType,
    branchId: scope.branchId,
    branchCode: member.chitGroup.branch?.code,
    intentId,
    confirmedAmount,
    reviewerId: scope.userId as string,
  });

  revalidatePath(modulePath(scope.appType, `/chits/${member.chitGroupId}`));
  revalidatePath(modulePath(scope.appType, '/chits/payments'));
  return result;
}

export async function rejectChitPaymentIntentAction(intentId: string, reason: string) {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) throw new Error('Forbidden');
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required');

  await rejectChitPaymentIntent({
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    intentId,
    reason: reason.trim(),
    reviewerId: scope.userId as string,
  });
  revalidatePath(modulePath(scope.appType, '/chits/payments'));
}

export async function recordAscaPoolTransaction(groupId: string, formData: FormData) {
  const { scope, group } = await loadScopedGroup(groupId);
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  if (resolveEngineTypeFromGroup(group) !== 'ASCA_SHG_REVOLVING') {
    throw new Error('Pool transactions apply only to ASCA / SHG Revolving Pool chits');
  }

  const txnType = value(formData, 'txnType');
  const allowedTypes = [
    'internal_loan_disburse',
    'internal_loan_repay',
    'interest_income',
    'admin_expense',
    'maturity_distribution',
  ];
  if (!txnType || !allowedTypes.includes(txnType)) {
    throw new Error('Invalid ASCA pool transaction type');
  }
  const memberId = value(formData, 'memberId');
  if (memberId) {
    const member = await prisma.chitMember.findFirst({
      where: { id: memberId, chitGroupId: group.id },
      select: { id: true },
    });
    if (!member) throw new Error('Member not found in this chit group');
  }
  const principalAmount = numberValue(formData, 'principalAmount', 0) ?? 0;
  const interestAmount = numberValue(formData, 'interestAmount', 0) ?? 0;
  const interestRatePct = numberValue(formData, 'interestRatePct');
  const notes = value(formData, 'notes');
  if (principalAmount < 0 || interestAmount < 0 || (principalAmount === 0 && interestAmount === 0)) {
    throw new Error('Transaction amount must be positive');
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.chitPoolTransaction.create({
      data: {
        tenantId: scope.tenantId,
        branchId: group.branchId,
        appType: scope.appType,
        chitGroupId: group.id,
        memberId: memberId ?? undefined,
        txnType,
        principalAmount,
        interestAmount,
        interestRatePct: interestRatePct ?? undefined,
        notes: notes ?? undefined,
        createdById: scope.userId ?? undefined,
      },
    });
    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: `asca_${txnType}`,
      entityType: 'chit_group',
      entityId: group.id,
      newValue: { txnId: row.id, txnType, memberId, principalAmount, interestAmount },
    });
    return row;
  });

  revalidatePath(modulePath(scope.appType, `/chits/${group.id}`));
  return created;
}

export async function simulateChitTemplateAction(
  input: ChitSimulationInput,
): Promise<ChitSimulationResult> {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer', 'agent']);
  return simulateChitLifecycle(input);
}
