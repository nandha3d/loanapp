import { winnerInterestPerPeriod, winnerInterestWindow } from '../../lib/chits/winnerInterest';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${actual}`);
  }
}

const fixed = {
  chitValue: 100000,
  totalMembers: 10,
  winnerInterestType: 'FIXED',
  winnerInterestValue: 1250,
  winnerInterestPeriods: 3,
};

assertEqual(winnerInterestPerPeriod(fixed), 1250, 'fixed winner interest amount');
assertEqual(
  JSON.stringify(winnerInterestWindow(fixed, 4)),
  JSON.stringify({ fromPeriod: 5, toPeriod: 7, periods: 3 }),
  'fixed winner interest period window',
);

const percent = {
  chitValue: 100000,
  totalMembers: 10,
  winnerInterestType: 'PERCENT',
  winnerInterestValue: 1.5,
  winnerInterestPeriods: 12,
};

assertEqual(winnerInterestPerPeriod(percent), 1500, 'percent winner interest amount');
assertEqual(
  JSON.stringify(winnerInterestWindow(percent, 8)),
  JSON.stringify({ fromPeriod: 9, toPeriod: 10, periods: 2 }),
  'winner interest window clamps at final period',
);

const none = {
  chitValue: 100000,
  totalMembers: 10,
  winnerInterestType: 'NONE',
  winnerInterestValue: 999,
  winnerInterestPeriods: 5,
};

assertEqual(winnerInterestPerPeriod(none), 0, 'none winner interest amount');

console.log('chitWinnerInterest tests passed');
