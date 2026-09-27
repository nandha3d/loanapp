import assert from 'node:assert/strict';
import { parseAccountingSettingsPatch } from '../lib/accounting/settingsUpdate';

assert.deepEqual(parseAccountingSettingsPatch({ adminJeCap: 1000.25, gstScheme: 'regular' }), {
  adminJeCap: 1000.25, gstScheme: 'regular',
});
for (const input of [
  {},
  { adminJeCap: -1 },
  { adminJeCap: 1.001 },
  { fiscalYearStartMonth: 13 },
  { postingOverrides: '[]' },
  { postingOverrides: '{bad' },
  { unknown: true },
]) {
  assert.throws(() => parseAccountingSettingsPatch(input));
}
console.log('Accounting settings patch validation passed');
