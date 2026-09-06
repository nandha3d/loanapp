import assert from 'node:assert/strict';

export function money(value: unknown): number {
  return Number(value ?? 0);
}

export function assertMoneyEqual(actual: unknown, expected: unknown, label: string) {
  assert.equal(Math.round(money(actual) * 100), Math.round(money(expected) * 100), label);
}

export function assertInstalmentSum(instalments: Array<{ dueAmount: unknown }>, total: unknown, label: string) {
  const sum = instalments.reduce((acc, item) => acc + money(item.dueAmount), 0);
  assertMoneyEqual(sum, total, label);
}
