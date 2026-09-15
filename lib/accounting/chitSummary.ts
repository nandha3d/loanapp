type Numeric = number | string | { toString(): string } | null;
type DateValue = string | Date | null;

function number(value: Numeric): number {
  return value == null ? 0 : Number(value);
}

function isInRange(value: DateValue, fromDate?: string, toDate?: string): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (fromDate && timestamp < new Date(`${fromDate}T00:00:00`).getTime()) return false;
  if (toDate && timestamp > new Date(`${toDate}T23:59:59.999`).getTime()) return false;
  return true;
}

export interface ChitAccountingInput {
  groups: Array<{ status: string; chitValue: Numeric; startDate: DateValue }>;
  subscriptions: Array<{
    dueDate: DateValue;
    paidAt: DateValue;
    dueAmount: Numeric;
    dividendAmount: Numeric;
    interestAmount: Numeric;
    penaltyAmount: Numeric;
    paidAmount: Numeric;
  }>;
  auctions: Array<{
    auctionDate: DateValue;
    completedAt: DateValue;
    status: string;
    prizeAmount: Numeric;
    dividend: Numeric;
  }>;
  fromDate?: string;
  toDate?: string;
}

export function calculateChitAccountingMetrics(input: ChitAccountingInput) {
  const activeGroups = input.groups.filter(
    (group) => group.status === 'active' && (!input.toDate || isInRange(group.startDate, undefined, input.toDate)),
  );
  const subscriptionsDueInRange = input.subscriptions.filter((subscription) =>
    isInRange(subscription.dueDate, input.fromDate, input.toDate),
  );
  const completedAuctions = input.auctions.filter((auction) =>
    auction.status === 'completed'
      && isInRange(auction.completedAt || auction.auctionDate, input.fromDate, input.toDate),
  );

  return {
    activeChitValue: activeGroups.reduce((total, group) => total + number(group.chitValue), 0),
    contributionsCollected: input.subscriptions
      .filter((subscription) => isInRange(subscription.paidAt, input.fromDate, input.toDate))
      .reduce((total, subscription) => total + number(subscription.paidAmount), 0),
    subscriptionReceivable: subscriptionsDueInRange.reduce(
      (total, subscription) => total + Math.max(
        0,
        number(subscription.dueAmount)
          - number(subscription.dividendAmount)
          + number(subscription.interestAmount)
          + number(subscription.penaltyAmount)
          - number(subscription.paidAmount),
      ),
      0,
    ),
    prizePayouts: completedAuctions.reduce((total, auction) => total + number(auction.prizeAmount), 0),
    dividendsDistributed: completedAuctions.reduce((total, auction) => total + number(auction.dividend), 0),
    activeGroups: activeGroups.length,
  };
}
