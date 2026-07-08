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
