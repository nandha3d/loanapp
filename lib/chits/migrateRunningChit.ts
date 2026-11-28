import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { createChitAudit } from './audit';
import { roundMoney } from './calculations';
import { calculateChitPeriodEngine } from './engineCalculator';
import {
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  parseChitEngineConfig,
  serializeChitEngineConfig,
  type ChitEngineType,
} from './engineTypes';
import { nextPeriodDate, parseFrequency } from './frequency';
import { assertCanActivateAnotherChitGroup } from './planEntitlements';
import { assertChitEngineTypeEnabled } from './settings';
import { generateCode } from '@/lib/utils';
import { normalizeIndianPhone } from './quickAddMembers';

export interface RunningChitMigrationMemberInput {
  name: string;
  phone: string;
  ticketNumber?: string;
  alreadyPrized: boolean;
  prizedCycleNumber?: number | null;
  historicalPrizeAmount?: number | null;
  historicalPayoutPendingAmount?: number | null;
  openingArrearsAmount?: number | null;
  openingAdvanceAmount?: number | null;
  nomineeName?: string | null;
  address?: string | null;
}

export interface MigrateRunningChitInput {
  name: string;
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  totalCycles?: number;
  currentActiveCycle: number;
  commissionPct?: number;
  auctionFrequency?: string;
  auctionType?: 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation';
  chitType?: 'unregistered' | 'registered';
  chitEngineType?: ChitEngineType;
  startDate: string;
  openingCashBalance?: number;
  openingForemanCommissionBalance?: number;
  stateCode?: string;
  registrationNo?: string;
  foremanName?: string;
  notes?: string;
  members: RunningChitMigrationMemberInput[];
}

export interface ValidatedMigrationMember {
  name: string;
  phone: string;
  ticketNumber: string;
  alreadyPrized: boolean;
  prizedCycleNumber: number | null;
  historicalPrizeAmount: number | null;
  historicalPayoutPendingAmount: number;
  openingArrearsAmount: number;
  openingAdvanceAmount: number;
  nomineeName: string | null;
  address: string | null;
}

export interface MigrationDryRunSummary {
  valid: boolean;
  errors: string[];
  warnings: string[];
  currentActiveCycle: number;
  historicalCyclesCount: number;
  futureCyclesCount: number;
  totalMembers: number;
  enrolledMembersCount: number;
  prizedCount: number;
  totalOpeningArrears: number;
  totalOpeningAdvances: number;
  totalHistoricalPayoutPending: number;
  openingCashBalance: number;
  members: ValidatedMigrationMember[];
}

/**
 * Pure validation & dry-run reconciliation for mid-cycle running chit migrations.
 * Safe in unit tests and dry-run previews without touching MySQL.
 */
export function validateRunningChitMigration(
  raw: MigrateRunningChitInput,
): MigrationDryRunSummary {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalMembers = Math.trunc(Number(raw.totalMembers) || 0);
  const totalCycles = Math.trunc(Number(raw.totalCycles ?? totalMembers) || totalMembers);
  const currentActiveCycle = Math.trunc(Number(raw.currentActiveCycle) || 1);
  const historicalCyclesCount = Math.max(0, currentActiveCycle - 1);
  const futureCyclesCount = Math.max(0, totalCycles - currentActiveCycle + 1);
  const openingCashBalance = roundMoney(Math.max(0, Number(raw.openingCashBalance ?? 0) || 0));

  if (!raw.name?.trim()) errors.push('Chit group name is required.');
  if (!(Number(raw.chitValue) > 0)) errors.push('Chit value must be greater than zero.');
  if (!(Number(raw.monthlyContrib) > 0)) errors.push('Installment amount must be greater than zero.');
  if (totalMembers < 2 || totalMembers > 200) errors.push('Total members must be between 2 and 200.');
  if (currentActiveCycle < 2 || currentActiveCycle > totalCycles) {
    errors.push(`currentActiveCycle (${currentActiveCycle}) must be between 2 and ${totalCycles}.`);
  }
  if (!Array.isArray(raw.members) || raw.members.length === 0) {
    errors.push('At least 1 member is required.');
  } else if (raw.members.length > totalMembers) {
    errors.push(`Member rows (${raw.members.length}) cannot exceed totalMembers (${totalMembers}).`);
  }

  const usedPrizedCycles = new Set<number>();
  const usedTickets = new Set<string>();
  const validatedMembers: ValidatedMigrationMember[] = [];
  let prizedCount = 0;
  let totalOpeningArrears = 0;
  let totalOpeningAdvances = 0;
  let totalHistoricalPayoutPending = 0;

  (raw.members ?? []).forEach((m, idx) => {
    const cleanPhone = normalizeIndianPhone(m.phone);
    if (!cleanPhone) {
      errors.push(`Member #${idx + 1} (${m.name || 'Unnamed'}) has an invalid phone number.`);
    }
    const ticketNumber = String(m.ticketNumber ?? idx + 1).trim() || String(idx + 1);
    if (usedTickets.has(ticketNumber)) {
      errors.push(`Duplicate ticket number: ${ticketNumber}`);
    }
    usedTickets.add(ticketNumber);

    const arrears = roundMoney(Number(m.openingArrearsAmount ?? 0) || 0);
    const advance = roundMoney(Number(m.openingAdvanceAmount ?? 0) || 0);
    if (arrears < 0 || advance < 0) {
      errors.push(`Member #${idx + 1} (${m.name}): opening balances cannot be negative.`);
    }
    if (arrears > 0 && advance > 0) {
      errors.push(
        `Member #${idx + 1} (${m.name}): cannot have both openingArrearsAmount (${arrears}) and openingAdvanceAmount (${advance}) simultaneously.`,
      );
    }

    const alreadyPrized = Boolean(m.alreadyPrized);
    let prizedCycle: number | null =
      m.prizedCycleNumber != null && Number.isFinite(Number(m.prizedCycleNumber))
        ? Math.trunc(Number(m.prizedCycleNumber))
        : null;
    const histPrize =
      m.historicalPrizeAmount != null && Number(m.historicalPrizeAmount) > 0
        ? roundMoney(Number(m.historicalPrizeAmount))
        : null;
    const histPending = roundMoney(Math.max(0, Number(m.historicalPayoutPendingAmount ?? 0) || 0));

    if (alreadyPrized) {
      prizedCount += 1;
      if (prizedCycle != null) {
        if (prizedCycle < 1 || prizedCycle >= currentActiveCycle) {
          errors.push(
            `Member #${idx + 1} (${m.name}): prizedCycleNumber (${prizedCycle}) must be < currentActiveCycle (${currentActiveCycle}).`,
          );
        } else if (usedPrizedCycles.has(prizedCycle)) {
          errors.push(`Duplicate prizedCycleNumber: Cycle ${prizedCycle} is assigned to multiple winners.`);
        } else {
          usedPrizedCycles.add(prizedCycle);
        }
      }
      if (histPrize != null && histPending > histPrize + 0.01) {
        errors.push(`Member #${idx + 1} (${m.name}): historical pending payout cannot exceed historical prize amount.`);
      }
    } else if (histPending > 0) {
      errors.push(`Member #${idx + 1} (${m.name}): non-prized member cannot have historicalPayoutPendingAmount.`);
    }

    totalOpeningArrears = roundMoney(totalOpeningArrears + arrears);
    totalOpeningAdvances = roundMoney(totalOpeningAdvances + advance);
    totalHistoricalPayoutPending = roundMoney(totalHistoricalPayoutPending + histPending);

    validatedMembers.push({
      name: (m.name || '').trim() || `Member ${idx + 1}`,
      phone: cleanPhone || m.phone,
      ticketNumber,
      alreadyPrized,
      prizedCycleNumber: prizedCycle,
      historicalPrizeAmount: histPrize,
      historicalPayoutPendingAmount: histPending,
      openingArrearsAmount: arrears,
      openingAdvanceAmount: advance,
      nomineeName: m.nomineeName?.trim() || null,
      address: m.address?.trim() || null,
    });
  });

  if (prizedCount > historicalCyclesCount) {
    errors.push(
      `Count of already-prized members (${prizedCount}) cannot exceed completed historical cycles (${historicalCyclesCount}).`,
    );
  }

  if (validatedMembers.length < totalMembers) {
    warnings.push(
      `${totalMembers - validatedMembers.length} slot(s) not yet enrolled; remaining slots can be added before activation/auctions.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    currentActiveCycle,
    historicalCyclesCount,
    futureCyclesCount,
    totalMembers,
    enrolledMembersCount: validatedMembers.length,
    prizedCount,
    totalOpeningArrears,
    totalOpeningAdvances,
    totalHistoricalPayoutPending,
    openingCashBalance,
    members: validatedMembers,
  };
}

export async function migrateRunningChit(
  scope: { tenantId: string; appType: string; branchId: string | null; userId: string },
  raw: MigrateRunningChitInput,
) {
  const dryRun = validateRunningChitMigration(raw);
  if (!dryRun.valid) {
    throw new Error(dryRun.errors.join(' '));
  }

  await assertCanActivateAnotherChitGroup(prisma, scope.tenantId);

  const requestedEngine = raw.chitEngineType ?? DEFAULT_ENABLED_CHIT_ENGINE_TYPES[0];
  const engineType = await assertChitEngineTypeEnabled(scope.tenantId, requestedEngine);
  const commissionPct = Number.isFinite(Number(raw.commissionPct)) ? Number(raw.commissionPct) : 5;
  const engineCfg = parseChitEngineConfig(null, engineType);
  engineCfg.foremanCompensation.commissionPct = commissionPct;

  const startDate = raw.startDate ? new Date(raw.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid start date');

  return prisma.$transaction(async (tx) => {
    const resolvedBranchId =
      scope.branchId ??
      (await tx.branch
        .findMany({ where: { tenantId: scope.tenantId, status: 'active' }, select: { id: true }, take: 2 })
        .then((rows) => (rows.length === 1 ? rows[0].id : null)));

    const existingCount = await tx.chitGroup.count({ where: { tenantId: scope.tenantId } });
    const groupCode = generateCode('CF', existingCount + 1, 5);
    const freq = parseFrequency({ auctionFrequency: raw.auctionFrequency ?? 'monthly' });
    const totalCycles = Math.trunc(Number(raw.totalCycles ?? dryRun.totalMembers) || dryRun.totalMembers);
    const openingCommission = roundMoney(Math.max(0, Number(raw.openingForemanCommissionBalance ?? 0) || 0));
    const creatorUser = scope.userId
      ? await tx.user.findFirst({
          where: {
            id: scope.userId,
            tenantId: scope.tenantId,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true, name: true },
        })
      : null;

    const group = await tx.chitGroup.create({
      data: {
        tenantId: scope.tenantId,
        branchId: resolvedBranchId || undefined,
        appType: 'chitfunds',
        groupCode,
        name: raw.name.trim(),
        chitValue: roundMoney(raw.chitValue),
        monthlyContrib: roundMoney(raw.monthlyContrib),
        totalMembers: dryRun.totalMembers,
        durationMonths: totalCycles,
        commissionPct,
        commissionBasis: 'BID_DISCOUNT',
        dividendPolicy: 'ALL_MEMBERS',
        dividendDistribution: 'ADJUST_NEXT_DUE',
        startDate,
        status: 'active',
        complianceStatus: 'active',
        chitType: raw.chitType === 'registered' ? 'registered' : 'unregistered',
        chitEngineType: engineType,
        engineConfig: serializeChitEngineConfig(engineCfg),
        auctionType: raw.auctionType ?? 'open_manual',
        auctionFrequency: raw.auctionFrequency ?? 'monthly',
        isMigrated: true,
        migrationStartCycle: dryRun.currentActiveCycle,
        openingCashBalance: dryRun.openingCashBalance,
        openingForemanCommissionBalance: openingCommission,
        migratedAt: new Date(),
        stateCode: (raw.stateCode || 'GENERIC').toUpperCase(),
        registrationNo: raw.registrationNo?.trim() || null,
        foremanName: raw.foremanName?.trim() || creatorUser?.name || null,
        remarks: raw.notes?.trim() || `Mid-cycle migration starting at Cycle ${dryRun.currentActiveCycle}/${totalCycles}.`,
      },
    });

    if (creatorUser) {
      await tx.chitGroupForeman.create({
        data: {
          chitGroupId: group.id,
          userId: creatorUser.id,
          roleLabel: 'Organizer / Foreman',
          isPrimary: true,
          assignedById: scope.userId,
        },
      });
    }

    // Resolve / create customers (MINIMAL KYC) & ChitMembers
    const createdMembers: Array<{
      id: string;
      spec: ValidatedMigrationMember;
    }> = [];

    for (const [idx, m] of dryRun.members.entries()) {
      const phoneCandidates = [m.phone, `91${m.phone}`, `+91${m.phone}`];
      let customer = await tx.customer.findFirst({
        where: {
          tenantId: scope.tenantId,
          appType: 'chitfunds',
          phone: { in: phoneCandidates },
          deletedAt: null,
          ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
        },
        select: { id: true },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: scope.tenantId,
            appType: 'chitfunds',
            branchId: resolvedBranchId || undefined,
            customerCode: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: m.name,
            phone: m.phone,
            address: m.address || undefined,
            kycStatus: 'MINIMAL',
            status: 'active',
          },
          select: { id: true },
        });
      }

      const member = await tx.chitMember.create({
        data: {
          chitGroupId: group.id,
          customerId: customer.id,
          memberNumber: idx + 1,
          ticketNo: m.ticketNumber,
          ticketShare: 1,
          subscriberStatus: 'active',
          agreementStatus: group.chitType === 'registered' ? 'pending' : 'signed',
          agreementSignedAt: group.chitType === 'registered' ? null : new Date(),
          nomineeName: m.nomineeName || undefined,
          hasWon: m.alreadyPrized,
          wonAt: m.alreadyPrized ? startDate : null,
          openingArrearsAmount: m.openingArrearsAmount,
          openingAdvanceAmount: m.openingAdvanceAmount,
          prizedCycleNumber: m.prizedCycleNumber,
          historicalPrizeAmount: m.historicalPrizeAmount,
          historicalPayoutPendingAmount: m.historicalPayoutPendingAmount,
        },
      });
      createdMembers.push({ id: member.id, spec: m });
    }

    // Map already-prized members to historical cycles 1..(k-1)
    const winnerByCycle = new Map<number, (typeof createdMembers)[number]>();
    for (const cm of createdMembers) {
      if (cm.spec.alreadyPrized && cm.spec.prizedCycleNumber != null) {
        winnerByCycle.set(cm.spec.prizedCycleNumber, cm);
      }
    }
    let autoCycleCursor = 1;
    for (const cm of createdMembers) {
      if (cm.spec.alreadyPrized && cm.spec.prizedCycleNumber == null) {
        while (winnerByCycle.has(autoCycleCursor) && autoCycleCursor < dryRun.currentActiveCycle) {
          autoCycleCursor += 1;
        }
        if (autoCycleCursor < dryRun.currentActiveCycle) {
          winnerByCycle.set(autoCycleCursor, cm);
          autoCycleCursor += 1;
        }
      }
    }

    // Create historical auctions (1..k-1): MIGRATED_HISTORICAL closed records, ZERO phantom dues
    for (let period = 1; period < dryRun.currentActiveCycle; period++) {
      const periodDate = nextPeriodDate(startDate, period, freq);
      const histWinner = winnerByCycle.get(period) ?? null;
      const prizeInput = histWinner?.spec.historicalPrizeAmount ?? roundMoney(raw.chitValue);
      const pendingPayout = histWinner?.spec.historicalPayoutPendingAmount ?? 0;

      const bd = calculateChitPeriodEngine({
        engineType,
        config: engineCfg,
        chitValue: roundMoney(raw.chitValue),
        monthlyContrib: roundMoney(raw.monthlyContrib),
        totalMembers: dryRun.totalMembers,
        periodNumber: period,
        commissionPct,
        commissionBasis: 'BID_DISCOUNT',
        dividendPolicy: 'ALL_MEMBERS',
        dividendDistribution: 'ADJUST_NEXT_DUE',
        winnerMemberIds: histWinner ? [histWinner.id] : [],
        prizeAmount: prizeInput,
        members: createdMembers.map((cm) => ({
          memberId: cm.id,
          memberName: cm.spec.name,
          ticketNo: cm.spec.ticketNumber,
          ticketShare: 1,
          hasWonBeforePeriod: cm.spec.alreadyPrized && histWinner?.id !== cm.id,
          isActive: true,
        })),
      });

      const hasPendingHistPayout = Boolean(histWinner && pendingPayout > 0);
      const auction = await tx.chitAuction.create({
        data: {
          chitGroupId: group.id,
          periodNumber: period,
          auctionDate: periodDate,
          scheduledAt: periodDate,
          status: hasPendingHistPayout ? 'payout_pending' : 'completed',
          roomStatus: 'closed',
          payoutStatus: histWinner ? (hasPendingHistPayout ? 'partially_paid' : 'paid') : 'not_ready',
          winnerMemberId: histWinner?.id ?? undefined,
          prizeAmount: bd.prizeAmount,
          grossPrizeAmount: bd.prizeAmount,
          netPayableAmount: bd.prizeAmount,
          totalDisbursedAmount: hasPendingHistPayout ? Math.max(0, roundMoney(bd.prizeAmount - pendingPayout)) : bd.prizeAmount,
          remainingPayableAmount: hasPendingHistPayout ? pendingPayout : 0,
          bidDiscount: bd.bidDiscount,
          commission: bd.commission,
          dividend: bd.dividendPerTicket,
          calculationBreakdown: JSON.stringify(bd),
          completedAt: periodDate,
          confirmedAt: periodDate,
          confirmedById: scope.userId,
          minutesText: `MIGRATED_HISTORICAL Period ${period}${histWinner ? ` — Winner: ${histWinner.spec.name} (#${histWinner.spec.ticketNumber})` : ''}.`,
        },
      });

      if (hasPendingHistPayout && histWinner) {
        await tx.chitSecurity.create({
          data: {
            tenantId: scope.tenantId,
            branchId: resolvedBranchId || undefined,
            chitGroupId: group.id,
            auctionId: auction.id,
            winnerMemberId: histWinner.id,
            securityType: 'MIGRATED_HISTORICAL',
            status: 'approved',
            verifiedById: scope.userId,
            verifiedAt: new Date(),
            approvedById: scope.userId,
            approvedAt: new Date(),
            details: `Historical unpaid payout remainder (${pendingPayout}) migrated for split disbursement.`,
          },
        });
      }
    }

    // Register opening arrears at Cycle (k - 1) ONLY for members with openingArrearsAmount > 0
    // so Task 1 arrears auto-deduction settles them automatically if they win future cycles
    const arrearCycle = Math.max(1, dryRun.currentActiveCycle - 1);
    const arrearDueDate = nextPeriodDate(startDate, arrearCycle, freq);
    for (const cm of createdMembers) {
      if (cm.spec.openingArrearsAmount > 0) {
        await tx.chitSubscription.create({
          data: {
            memberId: cm.id,
            periodNumber: arrearCycle,
            dueDate: arrearDueDate,
            dueAmount: cm.spec.openingArrearsAmount,
            baseDueAmount: cm.spec.openingArrearsAmount,
            paidAmount: 0,
            status: 'missed',
            notes: `Migrated opening arrears prior to Cycle ${dryRun.currentActiveCycle}`,
          },
        });
      }
    }

    // Generate active/upcoming auctions & subscriptions strictly for cycles k..N
    for (let period = dryRun.currentActiveCycle; period <= totalCycles; period++) {
      const periodDate = nextPeriodDate(startDate, period, freq);
      await tx.chitAuction.create({
        data: {
          chitGroupId: group.id,
          periodNumber: period,
          auctionDate: periodDate,
          scheduledAt: periodDate,
          status: 'pending',
          roomStatus: 'scheduled',
        },
      });

      const baseDue = roundMoney(raw.monthlyContrib);
      for (const cm of createdMembers) {
        const isFirstActivePeriod = period === dryRun.currentActiveCycle;
        const advanceToApply =
          isFirstActivePeriod && cm.spec.openingAdvanceAmount > 0
            ? Math.min(baseDue, cm.spec.openingAdvanceAmount)
            : 0;
        const status =
          advanceToApply <= 0
            ? 'upcoming'
            : advanceToApply + 0.01 >= baseDue
              ? 'paid'
              : 'partial';

        await tx.chitSubscription.create({
          data: {
            memberId: cm.id,
            periodNumber: period,
            dueDate: periodDate,
            dueAmount: baseDue,
            baseDueAmount: baseDue,
            paidAmount: advanceToApply,
            paidAt: advanceToApply > 0 ? new Date() : undefined,
            paymentMode: advanceToApply > 0 ? 'OPENING_ADVANCE' : undefined,
            status,
            notes: advanceToApply > 0 ? 'Applied from migrated opening advance credit' : undefined,
          },
        });
      }
    }

    // Explicit Opening Balance Ledger / Cash Book entry so Day Book & Trial Balance stay balanced
    if (dryRun.openingCashBalance > 0 || openingCommission > 0) {
      await tx.accountEntry.create({
        data: {
          tenantId: scope.tenantId,
          appType: 'chitfunds',
          entryDate: new Date(),
          type: 'capital_add',
          category: 'opening_balance',
          amount: dryRun.openingCashBalance,
          description: `Opening balance migration for ${group.name} (${groupCode}) at Cycle ${dryRun.currentActiveCycle}`,
          referenceId: group.id,
          referenceType: 'chit_group_migration',
          createdBy: scope.userId,
          branchId: resolvedBranchId || undefined,
        },
      });
    }

    await tx.chitRoomMessage.create({
      data: {
        tenantId: scope.tenantId,
        chitGroupId: group.id,
        senderUserId: scope.userId,
        senderName: 'Chit Admin',
        visibility: 'public',
        messageType: 'system_notice',
        body: `Migrated running chit "${group.name}" at Cycle ${dryRun.currentActiveCycle}/${totalCycles} (${createdMembers.length} members, opening arrears ${dryRun.totalOpeningArrears}).`,
      },
    });

    await createChitAudit(tx, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'migrate_running_chit',
      entityType: 'chit_group',
      entityId: group.id,
      newValue: {
        groupCode,
        currentActiveCycle: dryRun.currentActiveCycle,
        totalCycles,
        prizedCount: dryRun.prizedCount,
        totalOpeningArrears: dryRun.totalOpeningArrears,
        totalOpeningAdvances: dryRun.totalOpeningAdvances,
        openingCashBalance: dryRun.openingCashBalance,
      },
    });

    return {
      group,
      summary: dryRun,
    };
  });
}
