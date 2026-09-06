import { assertCanReleasePrizePayout } from '../../lib/chits/security';

function assertThrows(fn: () => void, expected: string) {
  try {
    fn();
  } catch (e: any) {
    if (!String(e?.message ?? '').includes(expected)) {
      throw new Error(`Expected "${expected}", got "${e?.message}"`);
    }
    return;
  }
  throw new Error(`Expected throw: ${expected}`);
}

assertCanReleasePrizePayout({
  auctionStatus: 'confirmed',
  payoutStatus: 'ready',
  securityStatus: 'approved',
  winnerMemberId: 'member-1',
  prizeAmount: 75000,
});

assertCanReleasePrizePayout({
  auctionStatus: 'payout_pending',
  payoutStatus: 'ready',
  securityStatus: 'approved',
  winnerMemberId: 'member-1',
  prizeAmount: 75000,
});

assertThrows(
  () => assertCanReleasePrizePayout({
    auctionStatus: 'scheduled',
    payoutStatus: 'ready',
    securityStatus: 'approved',
    winnerMemberId: 'member-1',
    prizeAmount: 75000,
  }),
  'confirmed',
);

assertThrows(
  () => assertCanReleasePrizePayout({
    auctionStatus: 'confirmed',
    payoutStatus: 'ready',
    securityStatus: 'pending',
    winnerMemberId: 'member-1',
    prizeAmount: 75000,
  }),
  'Security must be approved',
);

assertThrows(
  () => assertCanReleasePrizePayout({
    auctionStatus: 'confirmed',
    payoutStatus: 'security_pending',
    securityStatus: 'approved',
    winnerMemberId: 'member-1',
    prizeAmount: 75000,
  }),
  'Payout is not ready',
);

console.log('chitSecurity tests passed');
