import { HttpError } from '@/lib/httpError';
export function assertCanReleasePrizePayout(input: {
  auctionStatus: string;
  payoutStatus: string;
  securityStatus?: string | null;
  winnerMemberId?: string | null;
  prizeAmount?: number | null;
}) {
  if (!input.winnerMemberId) throw new HttpError(400, 'Auction winner is missing');
  if (!input.prizeAmount || input.prizeAmount <= 0) throw new HttpError(400, 'Prize amount is missing');
  if (!['confirmed', 'payout_pending'].includes(input.auctionStatus)) {
    throw new HttpError(400, 'Auction must be confirmed before payout');
  }
  if (input.securityStatus !== 'approved') {
    throw new HttpError(400, 'Security must be approved before payout');
  }
  if (input.payoutStatus !== 'ready') {
    throw new HttpError(409, 'Payout is not ready');
  }
}