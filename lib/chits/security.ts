export function assertCanReleasePrizePayout(input: {
  auctionStatus: string;
  payoutStatus: string;
  securityStatus?: string | null;
  winnerMemberId?: string | null;
  prizeAmount?: number | null;
}) {
  if (!input.winnerMemberId) throw new Error('Auction winner is missing');
  if (!input.prizeAmount || input.prizeAmount <= 0) throw new Error('Prize amount is missing');
  if (!['confirmed', 'payout_pending'].includes(input.auctionStatus)) {
    throw new Error('Auction must be confirmed before payout');
  }
  if (input.securityStatus !== 'approved') {
    throw new Error('Security must be approved before payout');
  }
  if (input.payoutStatus !== 'ready') {
    throw new Error('Payout is not ready');
  }
}
