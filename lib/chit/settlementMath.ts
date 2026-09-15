/**
 * Pure chit-auction money math — no DB, no `server-only`, so it is unit-testable
 * and importable from anywhere. The server settlement (`./settlement`) re-exports
 * this and layers the transactional accounting on top.
 *
 * The winning rule is a reverse auction: members bid the prize DOWN, so the
 * discount goes UP. The foreman keeps a commission on that discount; the rest
 * (the "dividend") is shared equally among the OTHER members — i.e. divided by
 * `totalMembers - 1`, because the winner does not receive a share of their own
 * discount. This math is legally regulated, so it is defined exactly once.
 * Values are intentionally NOT rounded — DB Decimal columns preserve precision.
 */
export type SettlementInput = {
  chitValue: number;
  prizeAmount: number;
  commissionPct: number;
  totalMembers: number;
};

export type SettlementResult = {
  bidDiscount: number;
  commission: number;
  dividend: number;
};

export function computeSettlement({
  chitValue,
  prizeAmount,
  commissionPct,
  totalMembers,
}: SettlementInput): SettlementResult {
  const bidDiscount = chitValue - prizeAmount;
  const commission = (bidDiscount * commissionPct) / 100;
  const dividend =
    totalMembers > 1 ? (bidDiscount - commission) / (totalMembers - 1) : 0;
  return { bidDiscount, commission, dividend };
}
