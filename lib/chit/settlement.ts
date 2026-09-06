import 'server-only';
import prisma from '@/lib/db';
import { computeSettlement } from './settlementMath';
import type { SettlementResult } from './settlementMath';
import { applyWinnerInterest } from '@/lib/chits/winnerInterest';

// Re-export the pure math so callers can `import { computeSettlement } from
// '@/lib/chit/settlement'`. The math itself lives in ./settlementMath (no
// `server-only`) so it stays unit-testable.
export { computeSettlement } from './settlementMath';
export type { SettlementInput, SettlementResult } from './settlementMath';

export type SettleWinnerInput = {
  auctionId: string;
  winnerMemberId: string;
  prizeAmount: number;
  tenantId: string;
  appType: string;
  actorUserId?: string | null;
};

export type SettleWinnerResult = SettlementResult & {
  auctionId: string;
  chitGroupId: string;
  winnerMemberId: string;
  prizeAmount: number;
  periodNumber: number;
};

/**
 * Records the winner of a chit auction and performs the full financial
 * settlement, transactionally and idempotently:
 *   - marks the auction `completed` (guarded — a second call is rejected so a
 *     late poll or manual tap can never double-settle),
 *   - flags the winning member `hasWon`,
 *   - posts a `chit_payout` accounting entry + debits the branch cash pool,
 *   - reduces every non-winner's FUTURE subscription dues by the dividend.
 *
 * Extracted verbatim from the web `recordAuctionWinner` action so web, mobile
 * result-only, and live-auction close all settle identically.
 */
export async function settleAuctionWinner(
  input: SettleWinnerInput,
): Promise<SettleWinnerResult> {
  const { auctionId, winnerMemberId, prizeAmount, tenantId, appType, actorUserId } =
    input;

  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    include: { chitGroup: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (auction.chitGroup.tenantId !== tenantId) throw new Error('Auction not in your tenant');
  if (auction.status === 'completed') throw new Error('Auction already completed');

  const winner = await prisma.chitMember.findFirst({
    where: { id: winnerMemberId, chitGroupId: auction.chitGroupId },
  });
  if (!winner) throw new Error('Member not found in this chit group');
  if (winner.hasWon) throw new Error('This member has already won in this group');

  const chitValue = Number(auction.chitGroup.chitValue);
  const commissionPct = Number(auction.chitGroup.commissionPct);
  const totalMembers = auction.chitGroup.totalMembers;
  const { bidDiscount, commission, dividend } = computeSettlement({
    chitValue,
    prizeAmount,
    commissionPct,
    totalMembers,
  });

  // Atomic double-settle guard: only the first caller to flip the auction out of
  // its non-completed state wins the update; a racing poll/tap sees count 0.
  const flip = await prisma.chitAuction.updateMany({
    where: { id: auctionId, status: { not: 'completed' } },
    data: {
      winnerMemberId,
      prizeAmount,
      bidDiscount,
      commission,
      dividend,
      status: 'completed',
      closedAt: new Date(),
    },
  });
  if (flip.count === 0) throw new Error('Auction already completed');

  await prisma.chitMember.updateMany({
    where: { id: winnerMemberId, chitGroup: { tenantId } },
    data: { hasWon: true, wonAt: new Date() },
  });

  // Prize handed to the winner is cash leaving the office → accounting payout +
  // branch pool debit, so Liquid Cash / capital drop. Net of all periods, the
  // commission the company keeps remains as positive capital.
  const payoutBranchId = auction.chitGroup.branchId;
  const prize = Number(prizeAmount);
  if (prize > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.accountEntry.create({
        data: {
          tenantId,
          appType,
          entryDate: new Date(),
          type: 'chit_payout',
          category: 'cash',
          amount: prize,
          description: `Chit prize payout — period ${auction.periodNumber}`,
          referenceId: auctionId,
          referenceType: 'chit_auction',
          createdBy: actorUserId as string,
          branchId: payoutBranchId || undefined,
        },
      });
      if (payoutBranchId) {
        const { chitPayoutFromBranch } = await import('@/lib/wallet');
        await chitPayoutFromBranch(tx, {
          tenantId,
          appType,
          branchId: payoutBranchId,
          amount: prize,
          refId: auctionId,
          byUserId: actorUserId,
        });
      }
    });
  }

  // Reduce future subscription dueAmount by dividend for all non-winner members.
  if (dividend > 0) {
    const futurePeriod = auction.periodNumber + 1;
    const nonWinnerMembers = await prisma.chitMember.findMany({
      where: { chitGroupId: auction.chitGroupId, id: { not: winnerMemberId } },
      select: { id: true },
    });
    for (const m of nonWinnerMembers) {
      await prisma.chitSubscription.updateMany({
        where: {
          memberId: m.id,
          periodNumber: { gte: futurePeriod },
          status: { not: 'paid' },
        },
        data: { dueAmount: { decrement: dividend } },
      });
    }
  }

  const winnerInterest = await applyWinnerInterest(prisma, {
    chitGroupId: auction.chitGroupId,
    winnerMemberId,
    wonPeriodNumber: auction.periodNumber,
    group: {
      chitValue,
      totalMembers,
      winnerInterestType: auction.chitGroup.winnerInterestType,
      winnerInterestValue: auction.chitGroup.winnerInterestValue != null
        ? Number(auction.chitGroup.winnerInterestValue)
        : null,
      winnerInterestPeriods: auction.chitGroup.winnerInterestPeriods,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorUserId ?? undefined,
      action: 'auction_winner',
      entityType: 'chit_auction',
      entityId: auctionId,
      newValue: JSON.stringify({ winnerMemberId, prizeAmount, bidDiscount, commission, dividend, winnerInterest }),
    },
  });

  return {
    auctionId,
    chitGroupId: auction.chitGroupId,
    winnerMemberId,
    prizeAmount: prize,
    periodNumber: auction.periodNumber,
    bidDiscount,
    commission,
    dividend,
  };
}
