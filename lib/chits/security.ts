export function assertCanReleasePrizePayout(input: {
  auctionStatus: string;
  payoutStatus: string;
  securityStatus?: string | null;
  winnerMemberId?: string | null;
  prizeAmount?: number | null;
  activeGuaranteeLock?: {
    guaranteedMemberName: string;
    guaranteedTicketNo?: string | null;
    unpaidPeriods: number;
  } | null;
}) {
  if (!input.winnerMemberId) throw new Error('Auction winner is missing');
  if (!input.prizeAmount || input.prizeAmount <= 0) throw new Error('Prize amount is missing');
  if (!['confirmed', 'payout_pending', 'completed'].includes(input.auctionStatus)) {
    throw new Error('Auction must be confirmed before payout');
  }
  if (input.securityStatus !== 'approved') {
    throw new Error('Security must be approved before payout');
  }
  if (!['ready', 'partially_paid'].includes(input.payoutStatus)) {
    throw new Error('Payout is not ready');
  }
  if (input.activeGuaranteeLock && input.activeGuaranteeLock.unpaidPeriods > 0) {
    const label = input.activeGuaranteeLock.guaranteedTicketNo
      ? `${input.activeGuaranteeLock.guaranteedMemberName} (Ticket ${input.activeGuaranteeLock.guaranteedTicketNo})`
      : input.activeGuaranteeLock.guaranteedMemberName;
    throw new Error(
      `Payout locked (Jameen guarantor hold): guaranteed member ${label} still has ${input.activeGuaranteeLock.unpaidPeriods} unpaid period(s).`,
    );
  }
}
