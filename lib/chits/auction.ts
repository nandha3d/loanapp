import { calculateChitAuction } from './calculations';
import type { ChitAuctionCalculationInput } from './types';

export function getWinningBid<T extends { bidDiscount: number; bidTime: Date; status: string }>(bids: T[]): T | null {
  const valid = bids.filter((bid) => bid.status === 'valid');
  if (!valid.length) return null;
  return valid.sort((a, b) => {
    if (b.bidDiscount !== a.bidDiscount) return b.bidDiscount - a.bidDiscount;
    return a.bidTime.getTime() - b.bidTime.getTime();
  })[0] ?? null;
}

// All valid bids tied at the highest discount. When the group's tieBreakRule is
// LOTTERY_AMONG_TIED and this returns more than one bid, the winner must come from
// a lottery draw among them (lib/chits/lottery.ts) instead of earliest-bid order.
export function getTopBids<T extends { bidDiscount: number; bidTime: Date; status: string }>(bids: T[]): T[] {
  const valid = bids.filter((bid) => bid.status === 'valid');
  if (!valid.length) return [];
  const topDiscount = Math.max(...valid.map((bid) => bid.bidDiscount));
  return valid.filter((bid) => bid.bidDiscount === topDiscount);
}

export function generateAuctionMinutes(input: {
  groupName: string;
  periodNumber: number;
  auctionDate: Date;
  totalMembers: number;
  presentCount: number;
  winnerName: string;
  prizeAmount: number;
  bidDiscount: number;
  commission: number;
  dividend: number;
}) {
  return [
    `Auction for ${input.groupName}, period ${input.periodNumber}, was conducted on ${input.auctionDate.toDateString()}.`,
    `${input.presentCount} out of ${input.totalMembers} subscribers were marked present/proxy.`,
    `${input.winnerName} was selected as the prize subscriber.`,
    `Prize amount: ${input.prizeAmount}. Bid discount: ${input.bidDiscount}.`,
    `Foreman commission: ${input.commission}. Dividend per eligible subscriber: ${input.dividend}.`,
  ].join('\n');
}

export function previewAuctionCalculation(input: ChitAuctionCalculationInput) {
  return calculateChitAuction(input);
}
